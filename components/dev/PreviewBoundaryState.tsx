"use client";
import ErrorPage from "../../app/error";
import Loading from "../../app/loading";

export function PreviewBoundaryState({
  screen,
}: {
  screen: "error" | "loading";
}) {
  return screen === "loading" ? (
    <Loading />
  ) : (
    <ErrorPage
      error={new Error("Local design preview")}
      reset={() => window.location.reload()}
    />
  );
}
