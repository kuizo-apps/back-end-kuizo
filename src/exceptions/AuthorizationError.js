import ClientError from "./ClientError.js";

class AuthorizationError extends ClientError {
  constructor(message) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export default AuthorizationError;
