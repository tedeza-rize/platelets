import { ArrowRight, Check, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { cloneElement, isValidElement, type ReactNode, useId } from "react";
import styles from "./setup-wizard-content.module.css";

export function Field({
  children,
  error,
  label,
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  const generatedId = useId();
  const childId =
    isValidElement<{ id?: string }>(children) && children.props.id
      ? children.props.id
      : generatedId;
  const errorId = `${childId}-error`;
  const control = isValidElement<{
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    id?: string;
  }>(children)
    ? cloneElement(children, {
        "aria-describedby": error
          ? errorId
          : children.props["aria-describedby"],
        "aria-invalid": Boolean(error) || undefined,
        id: childId,
      })
    : children;

  return (
    <label
      className={`${styles.field} ${error ? styles.fieldInvalid : ""}`}
      htmlFor={childId}
    >
      <span>{label}</span>
      {control}
      {error ? (
        <span className={styles.fieldError} id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function EnvironmentCheckMark({
  ok,
  pending,
}: {
  ok: boolean;
  pending: boolean;
}) {
  let className = styles.failMark;

  if (ok) {
    className = styles.okMark;
  } else if (pending) {
    className = styles.pendingMark;
  }

  return (
    <span className={className}>
      <EnvironmentCheckIcon ok={ok} pending={pending} />
    </span>
  );
}

function EnvironmentCheckIcon({
  ok,
  pending,
}: {
  ok: boolean;
  pending: boolean;
}) {
  if (ok) {
    return <Check aria-hidden="true" size={16} />;
  }

  if (pending) {
    return <LoaderCircle aria-hidden="true" size={16} />;
  }

  return <X aria-hidden="true" size={16} />;
}

export function ContinueIcon({
  busy,
  lastStep,
}: {
  busy: boolean;
  lastStep: boolean;
}) {
  if (busy) {
    return <LoaderCircle aria-hidden="true" size={17} />;
  }

  return lastStep ? (
    <ShieldCheck aria-hidden="true" size={17} />
  ) : (
    <ArrowRight aria-hidden="true" size={17} />
  );
}
