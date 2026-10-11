/** Keep existing sessions valid while preventing new email sign-ins/invitations. */
export function emailSignInEnabled(): boolean {
  return (
    process.env.EMAIL_SIGN_IN_ENABLED !== "false" &&
    Boolean(process.env.EMAIL_SERVER?.trim()) &&
    Boolean(process.env.EMAIL_FROM?.trim())
  );
}
