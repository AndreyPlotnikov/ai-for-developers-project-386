import { useEffect, useState } from "react";

export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(
      (value) => {
        if (controller.signal.aborted) return;
        setData(value);
        setStatus("ready");
      },
      () => {
        if (!controller.signal.aborted) setStatus("error");
      },
    );
    return () => controller.abort();
  }, [load, revision]);

  return {
    data,
    status,
    refresh() {
      if (status === "loading") return;
      setStatus("loading");
      setRevision((value) => value + 1);
    },
  };
}

export function LoadStatus({
  resource,
  message,
}: {
  resource: { data: unknown; status: string; refresh: () => void };
  message: string;
}) {
  const { data, status, refresh } = resource;
  return (
    <div className="load-status">
      <p role="status">{status === "loading" ? "Загрузка…" : ""}</p>
      {status === "error" && (
        <p role="alert">
          {message} {data !== undefined && "Показаны ранее загруженные данные."}
        </p>
      )}
      <button
        className="secondary-button"
        type="button"
        onClick={refresh}
        aria-disabled={status === "loading"}
      >
        {status === "error" ? "Повторить" : "Обновить"}
      </button>
    </div>
  );
}
