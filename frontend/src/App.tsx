import { Alert, Badge, Container, Paper, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { health } from "./generated/api";

type Connection = "loading" | "connected" | "error";

export default function App() {
  const [connection, setConnection] = useState<Connection>("loading");

  useEffect(() => {
    const controller = new AbortController();
    health({ signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) {
          setConnection(
            response.status === 200 && response.data.status === "ok" ? "connected" : "error",
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setConnection("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>Календарь звонков</Title>
          <Text c="dimmed" mt="xs">
            Сервис для записи на встречи
          </Text>
        </div>
        <Paper withBorder p="lg" radius="md">
          <Stack gap="sm">
            <Text fw={600}>Состояние сервера</Text>
            {connection === "loading" && <Badge color="gray">Проверяем соединение</Badge>}
            {connection === "connected" && <Badge color="green">Сервер доступен</Badge>}
            {connection === "error" && (
              <Alert color="red" title="Нет соединения с сервером">
                Убедитесь, что бекенд запущен, и обновите страницу.
              </Alert>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
