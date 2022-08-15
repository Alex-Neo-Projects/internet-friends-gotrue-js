import { Fetch, get, post, put, remove } from './lib/fetch'
import { expiresAt, resolveFetch } from './lib/helpers'
import {
  AdminUserAttributes,
  OpenIDConnectCredentials,
  Provider,
  Session,
  User,
  UserAttributes,
  VerifyOTPParams,
  UserResponse,
} from './lib/types'
import { AuthError, isAuthError } from './lib/errors'

export default class GoTrueApi {
  protected url: string
  protected headers: {
    [key: string]: string
  }
  protected fetch: Fetch

  constructor({
    url = '',
    headers = {},
    fetch,
  }: {
    url: string
    headers?: {
      [key: string]: string
    }
    fetch?: Fetch
  }) {
    this.url = url
    this.headers = headers
    this.fetch = resolveFetch(fetch)
  }

  /**
   * Create a temporary object with all configured headers and
   * adds the Authorization token to be used on request methods
   * @param jwt A valid, logged-in JWT.
   */
  private _createRequestHeaders(jwt: string) {
    const headers = { ...this.headers }
    headers['Authorization'] = `Bearer ${jwt}`
    return headers
  }

  /**
   * Generates the relevant login URL for a third-party provider.
   * @param provider One of the providers supported by GoTrue.
   * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param options.scopes A space-separated list of scopes granted to the OAuth application.
   */
  getUrlForProvider(
    provider: Provider,
    options: {
      redirectTo?: string
      scopes?: string
      queryParams?: { [key: string]: string }
    }
  ) {
    const urlParams: string[] = [`provider=${encodeURIComponent(provider)}`]
    if (options?.redirectTo) {
      urlParams.push(`redirect_to=${encodeURIComponent(options.redirectTo)}`)
    }
    if (options?.scopes) {
      urlParams.push(`scopes=${encodeURIComponent(options.scopes)}`)
    }
    if (options?.queryParams) {
      const query = new URLSearchParams(options.queryParams)
      urlParams.push(`${query}`)
    }
    return `${this.url}/authorize?${urlParams.join('&')}`
  }

  /**
   * Creates a new user using their email address.
   * @param email The email address of the user.
   * @param password The password of the user.
   * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param options.data Optional user metadata.
   * @param options.captchaToken Verification token received when the user completes the captcha on your site.
   *
   * @returns A logged-in session if the server has "autoconfirm" ON
   * @returns A user if the server has "autoconfirm" OFF
   */
  async signUpWithEmail(
    email: string,
    password: string,
    options: {
      redirectTo?: string
      data?: object
      captchaToken?: string
    } = {}
  ): Promise<
    | {
        data: User
        error: null
      }
    | {
        data: Session
        error: null
      }
    | { data: null; error: AuthError }
  > {
    try {
      const headers = { ...this.headers }
      let queryString = ''
      if (options.redirectTo) {
        queryString = '?redirect_to=' + encodeURIComponent(options.redirectTo)
      }
      const data = await post(
        this.fetch,
        `${this.url}/signup${queryString}`,
        {
          email,
          password,
          data: options.data,
          gotrue_meta_security: { captcha_token: options.captchaToken },
        },
        { headers }
      )
      const session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { data: session, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Logs in an existing user using their email address.
   * @param email The email address of the user.
   * @param password The password of the user.
   * @param captchaToken Verification token received when the user completes the captcha on your site.
   */
  async signInWithEmail(
    email: string,
    password: string,
    options: {
      captchaToken?: string
    } = {}
  ): Promise<
    | {
        data: Session
        error: null
      }
    | { data: null; error: AuthError }
  > {
    try {
      const headers = { ...this.headers }
      const data = await post(
        this.fetch,
        `${this.url}/token?grant_type=password`,
        { email, password, gotrue_meta_security: { captcha_token: options.captchaToken } },
        { headers }
      )
      const session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { data: session, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
      }
      throw error
    }
  }

  /**
   * Signs up a new user using their phone number and a password.
   * @param phone The phone number of the user.
   * @param password The password of the user.
   * @param options.data Optional user metadata.
   * @param options.captchaToken Verification token received when the user completes the captcha on your site.
   */
  async signUpWithPhone(
    phone: string,
    password: string,
    options: {
      data?: object
      captchaToken?: string
    } = {}
  ): Promise<
    | {
        data: Session
        error: null
      }
    | {
        data: User
        error: null
      }
    | { data: null; error: AuthError }
  > {
    try {
      const headers = { ...this.headers }
      const data = await post(
        this.fetch,
        `${this.url}/signup`,
        {
          phone,
          password,
          data: options.data,
          gotrue_meta_security: { captcha_token: options.captchaToken },
        },
        { headers }
      )
      const session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { data: session, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Logs in an existing user using their phone number and password.
   * @param phone The phone number of the user.
   * @param password The password of the user.
   * @param options.captchaToken Verification token received when the user completes the captcha on your site.
   */
  async signInWithPhone(
    phone: string,
    password: string,
    options: {
      captchaToken?: string
    } = {}
  ): Promise<
    | {
        session: Session
        error: null
      }
    | { session: null; error: AuthError }
  > {
    try {
      const headers = { ...this.headers }
      const session = await post(
        this.fetch,
        `${this.url}/token?grant_type=password`,
        { phone, password, gotrue_meta_security: { captcha_token: options.captchaToken } },
        { headers }
      )
      if (session.expires_in) session.expires_at = expiresAt(session.expires_in)
      return { session, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { session: null, error }
      }

      throw error
    }
  }

  /**
   * Logs in an OpenID Connect user using their id_token.
   * @param id_token The IDToken of the user.
   * @param nonce The nonce of the user. The nonce is a random value generated by the developer (= yourself) before the initial grant is started. You should check the OpenID Connect specification for details. https://openid.net/developers/specs/
   * @param provider The provider of the user.
   * @param client_id The clientID of the user.
   * @param issuer The issuer of the user.
   */
  async signInWithOpenIDConnect({
    id_token,
    nonce,
    client_id,
    issuer,
    provider,
  }: OpenIDConnectCredentials): Promise<
    | {
        session: Session
        error: null
      }
    | { session: null; error: AuthError }
  > {
    try {
      const headers = { ...this.headers }
      const queryString = '?grant_type=id_token'
      const session = await post(
        this.fetch,
        `${this.url}/token${queryString}`,
        { id_token, nonce, client_id, issuer, provider },
        { headers }
      )
      // const session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(session.expires_in)
      return { session, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { session: null, error }
      }

      throw error
    }
  }

  /**
   * Sends a magic login link to an email address.
   * @param email The email address of the user.
   * @param options.shouldCreateUser A boolean flag to indicate whether to automatically create a user on magiclink / otp sign-ins if the user doesn't exist. Defaults to true.
   * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param options.captchaToken Verification token received when the user completes the captcha on your site.
   */
  async sendMagicLinkEmail(
    email: string,
    options: {
      shouldCreateUser?: boolean
      redirectTo?: string
      captchaToken?: string
    } = {}
  ): Promise<
    | {
        data: {}
        error: null
      }
    | { data: null; error: AuthError }
  > {
    try {
      const headers = { ...this.headers }
      let queryString = ''
      if (options.redirectTo) {
        queryString += '?redirect_to=' + encodeURIComponent(options.redirectTo)
      }

      const shouldCreateUser = options.shouldCreateUser ?? true
      const data = await post(
        this.fetch,
        `${this.url}/otp${queryString}`,
        {
          email,
          create_user: shouldCreateUser,
          gotrue_meta_security: { captcha_token: options.captchaToken },
        },
        { headers }
      )
      return { data, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Sends a mobile OTP via SMS. Will register the account if it doesn't already exist
   * @param phone The user's phone number WITH international prefix
   * @param options.shouldCreateUser A boolean flag to indicate whether to automatically create a user on magiclink / otp sign-ins if the user doesn't exist. Defaults to true.
   * @param options.captchaToken Verification token received when the user completes the captcha on your site.
   */
  async sendMobileOTP(
    phone: string,
    options: {
      shouldCreateUser?: boolean
      captchaToken?: string
    } = {}
  ): Promise<
    | {
        data: {}
        error: null
      }
    | { data: null; error: AuthError }
  > {
    try {
      const shouldCreateUser = options.shouldCreateUser ?? true
      const headers = { ...this.headers }
      const data = await post(
        this.fetch,
        `${this.url}/otp`,
        {
          phone,
          create_user: shouldCreateUser,
          gotrue_meta_security: { captcha_token: options.captchaToken },
        },
        { headers }
      )
      return { data, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Removes a logged-in session.
   * @param jwt A valid, logged-in JWT.
   */
  async signOut(jwt: string): Promise<{ error: AuthError | null }> {
    try {
      await post(
        this.fetch,
        `${this.url}/logout`,
        {},
        { headers: this._createRequestHeaders(jwt), noResolveJson: true }
      )
      return { error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { error }
      }

      throw error
    }
  }

  /**
   * Send User supplied Email / Mobile OTP to be verified
   * @param email The user's email address
   * @param phone The user's phone number WITH international prefix
   * @param token token that user was sent to their mobile phone
   * @param type verification type that the otp is generated for
   * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
   */
  async verifyOTP(
    { email, phone, token, type = 'sms' }: VerifyOTPParams,
    options: {
      redirectTo?: string
    } = {}
  ): Promise<
    | {
        data: User
        error: null
      }
    | {
        data: Session
        error: null
      }
    | { data: null; error: AuthError }
  > {
    try {
      const headers = { ...this.headers }
      const data = await post(
        this.fetch,
        `${this.url}/verify`,
        { email, phone, token, type, redirect_to: options.redirectTo },
        { headers }
      )
      const session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { data: session, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Sends an invite link to an email address.
   * @param email The email address of the user.
   * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param options.data Optional user metadata
   */
  async inviteUserByEmail(
    email: string,
    options: {
      redirectTo?: string
      data?: object
    } = {}
  ): Promise<
    | {
        user: User
        error: null
      }
    | { user: null; error: AuthError }
  > {
    try {
      const headers = { ...this.headers }
      let queryString = ''
      if (options.redirectTo) {
        queryString += '?redirect_to=' + encodeURIComponent(options.redirectTo)
      }
      const user = await post(
        this.fetch,
        `${this.url}/invite${queryString}`,
        { email, data: options.data },
        { headers }
      )
      return { user, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { user: null, error }
      }

      throw error
    }
  }

  /**
   * Sends a reset request to an email address.
   * @param email The email address of the user.
   * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param options.captchaToken Verification token received when the user completes the captcha on your site.
   */
  async resetPasswordForEmail(
    email: string,
    options: {
      redirectTo?: string
      captchaToken?: string
    } = {}
  ): Promise<
    | {
        data: {}
        error: null
      }
    | { data: null; error: AuthError }
  > {
    try {
      const headers = { ...this.headers }
      let queryString = ''
      if (options.redirectTo) {
        queryString += '?redirect_to=' + encodeURIComponent(options.redirectTo)
      }
      const data = await post(
        this.fetch,
        `${this.url}/recover${queryString}`,
        { email, gotrue_meta_security: { captcha_token: options.captchaToken } },
        { headers }
      )
      return { data, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Generates a new JWT.
   * @param refreshToken A valid refresh token that was returned on login.
   */
  async refreshAccessToken(refreshToken: string): Promise<
    | {
        session: Session
        error: null
      }
    | { session: null; error: AuthError }
  > {
    try {
      const data: any = await post(
        this.fetch,
        `${this.url}/token?grant_type=refresh_token`,
        { refresh_token: refreshToken },
        { headers: this.headers }
      )
      const session = { ...data }
      if (session.expires_in) session.expires_at = expiresAt(data.expires_in)
      return { session, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { session: null, error }
      }

      throw error
    }
  }

  /**
   * Generates links to be sent via email or other.
   * @param type The link type ("signup" or "magiclink" or "recovery" or "invite").
   * @param email The user's email.
   * @param options.password User password. For signup only.
   * @param options.data Optional user metadata. For signup only.
   * @param options.redirectTo The link type ("signup" or "magiclink" or "recovery" or "invite").
   */
  async generateLink(
    type:
      | 'signup'
      | 'magiclink'
      | 'recovery'
      | 'invite'
      | 'email_change_current'
      | 'email_change_new',
    email: string,
    options: {
      password?: string
      data?: object
      redirectTo?: string
    } = {}
  ): Promise<
    | {
        data: User
        error: null
      }
    | {
        data: Session
        error: null
      }
    | { data: null; error: AuthError }
  > {
    try {
      const data: any = await post(
        this.fetch,
        `${this.url}/admin/generate_link`,
        {
          type,
          email,
          password: options.password,
          data: options.data,
          redirect_to: options.redirectTo,
        },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  // User Admin API

  /**
   * Creates a new user.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @param attributes The data you want to create the user with.
   */
  async createUser(
    attributes: AdminUserAttributes
  ): Promise<
    { user: User; data: User; error: null } | { user: null; data: null; error: AuthError }
  > {
    try {
      const data: any = await post(this.fetch, `${this.url}/admin/users`, attributes, {
        headers: this.headers,
      })
      return { user: data, data, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { user: null, data: null, error }
      }

      throw error
    }
  }

  /**
   * Get a list of users.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async listUsers(): Promise<{ users: User[]; error: null } | { users: null; error: AuthError }> {
    try {
      const data: any = await get(this.fetch, `${this.url}/admin/users`, {
        headers: this.headers,
      })
      return { users: data.users, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { users: null, error }
      }

      throw error
    }
  }

  /**
   * Get user by id.
   *
   * @param uid The user's unique identifier
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async getUserById(
    uid: string
  ): Promise<{ user: User; error: null } | { user: null; error: AuthError }> {
    try {
      const user = await get(this.fetch, `${this.url}/admin/users/${uid}`, {
        headers: this.headers,
      })
      return { user, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { user: null, error }
      }

      throw error
    }
  }

  /**
   * Updates the user data.
   *
   * @param attributes The data you want to update.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async updateUserById(
    uid: string,
    attributes: AdminUserAttributes
  ): Promise<
    | {
        user: User
        error: null
      }
    | { user: null; error: AuthError }
  > {
    try {
      this //
      const user = await put(this.fetch, `${this.url}/admin/users/${uid}`, attributes, {
        headers: this.headers,
      })
      return { user, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { user: null, error }
      }

      throw error
    }
  }

  /**
   * Delete a user. Requires a `service_role` key.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   *
   * @param uid The user uid you want to remove.
   */
  async deleteUser(uid: string): Promise<
    | {
        user: User
        error: null
      }
    | { user: null; error: AuthError }
  > {
    try {
      const user = await remove(
        this.fetch,
        `${this.url}/admin/users/${uid}`,
        {},
        {
          headers: this.headers,
        }
      )
      return { user, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { user: null, error }
      }

      throw error
    }
  }

  /**
   * Gets the current user details.
   *
   * This method is called by the GoTrueClient `update` where
   * the jwt is set to this.currentSession.access_token
   * and therefore, acts like getting the currently authenticated user
   *
   * @param jwt A valid, logged-in JWT. Typically, the access_token for the currentSession
   */
  async getUser(jwt: string): Promise<UserResponse> {
    try {
      const user: User = await get(this.fetch, `${this.url}/user`, {
        headers: this._createRequestHeaders(jwt),
      })
      return { data: { user }, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error }
      }

      throw error
    }
  }

  /**
   * Updates the user data.
   * @param jwt A valid, logged-in JWT.
   * @param attributes The data you want to update.
   */
  async updateUser(jwt: string, attributes: UserAttributes): Promise<UserResponse> {
    try {
      const user: User = await put(this.fetch, `${this.url}/user`, attributes, {
        headers: this._createRequestHeaders(jwt),
      })
      return { data: { user }, error: null }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error }
      }
      throw error
    }
  }
}
