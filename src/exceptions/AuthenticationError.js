import ClientError from "./ClientError.js";

class AuthenticationError extends ClientError {
  constructor(message) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export default AuthenticationError;
