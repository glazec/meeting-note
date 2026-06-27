export class SharedOnlyAccessError extends Error {
  constructor() {
    super("Shared users cannot add meetings");
    this.name = "SharedOnlyAccessError";
  }
}
