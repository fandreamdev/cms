export type TokenType = 'access' | 'refresh'

export interface TokenPayload {
  sub: number
  tokenType: TokenType
  jti: string
}
