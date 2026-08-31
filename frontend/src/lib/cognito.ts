import "server-only";
import { createHmac } from "node:crypto";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  type InitiateAuthCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const cognito = new CognitoIdentityProviderClient({});
const secretsManager = new SecretsManagerClient({});

interface CognitoAppConfig {
  clientId: string;
  clientSecret: string;
  userPoolId: string;
}

let cachedConfig: CognitoAppConfig | null = null;

async function getConfig(): Promise<CognitoAppConfig> {
  if (cachedConfig) return cachedConfig;

  const secretArn = process.env.COGNITO_CLIENT_SECRET_ARN;
  if (!secretArn) throw new Error("COGNITO_CLIENT_SECRET_ARN não configurado.");

  const result = await secretsManager.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );
  if (!result.SecretString) throw new Error("Secret do Cognito sem SecretString.");

  cachedConfig = JSON.parse(result.SecretString) as CognitoAppConfig;
  return cachedConfig;
}

function secretHash(username: string, clientId: string, clientSecret: string) {
  return createHmac("sha256", clientSecret)
    .update(username + clientId)
    .digest("base64");
}

export interface Tokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
}

function tokensFromResult(result: InitiateAuthCommandOutput): Tokens {
  const auth = result.AuthenticationResult;
  if (!auth?.AccessToken || !auth.IdToken) {
    throw new Error("Cognito não retornou tokens de autenticação.");
  }
  return {
    accessToken: auth.AccessToken,
    idToken: auth.IdToken,
    refreshToken: auth.RefreshToken,
    expiresIn: auth.ExpiresIn ?? 3600,
  };
}

export async function signUp(email: string, password: string) {
  const { clientId, clientSecret } = await getConfig();
  await cognito.send(
    new SignUpCommand({
      ClientId: clientId,
      SecretHash: secretHash(email, clientId, clientSecret),
      Username: email,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }],
    })
  );
}

export async function confirmSignUp(email: string, code: string) {
  const { clientId, clientSecret } = await getConfig();
  await cognito.send(
    new ConfirmSignUpCommand({
      ClientId: clientId,
      SecretHash: secretHash(email, clientId, clientSecret),
      Username: email,
      ConfirmationCode: code,
    })
  );
}

export async function login(email: string, password: string): Promise<Tokens> {
  const { clientId, clientSecret } = await getConfig();
  const result = await cognito.send(
    new InitiateAuthCommand({
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: secretHash(email, clientId, clientSecret),
      },
    })
  );
  return tokensFromResult(result);
}

export async function refreshSession(refreshToken: string, username: string): Promise<Tokens> {
  const { clientId, clientSecret } = await getConfig();
  const result = await cognito.send(
    new InitiateAuthCommand({
      ClientId: clientId,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
        SECRET_HASH: secretHash(username, clientId, clientSecret),
      },
    })
  );
  return { ...tokensFromResult(result), refreshToken };
}

export async function logout(accessToken: string) {
  await cognito.send(new GlobalSignOutCommand({ AccessToken: accessToken }));
}

const MENSAGENS_POR_CODIGO: Record<string, string> = {
  UsernameExistsException: "Já existe uma conta com este e-mail.",
  NotAuthorizedException: "E-mail ou senha incorretos.",
  UserNotConfirmedException: "Confirme seu e-mail antes de entrar.",
  UserNotFoundException: "E-mail ou senha incorretos.",
  CodeMismatchException: "Código de confirmação inválido.",
  ExpiredCodeException: "Código de confirmação expirado. Solicite um novo.",
  InvalidPasswordException:
    "Senha muito fraca. Use ao menos 8 caracteres, com maiúscula, minúscula e número.",
  LimitExceededException: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
};

export function mensagemErroCognito(err: unknown): string {
  const nome = err instanceof Error ? err.name : "";
  return MENSAGENS_POR_CODIGO[nome] ?? "Não foi possível completar a operação. Tente novamente.";
}
