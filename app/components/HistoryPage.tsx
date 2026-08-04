"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  IconChevronRight,
  Label,
  SearchField,
  Switch,
  Surface,
  Table,
  Typography,
} from "@heroui/react";
import type { OrderSummary } from "@/lib/orders";
import type { PizzaOrderSummary } from "@/lib/pizza";
import {
  countSentHistoryRecords,
  countVisibleHistoryRecords,
  filterHistoryRecords,
  formatHistoryDate,
  formatHistoryRecordCount,
  formatHistoryRecordTotal,
  formatHistorySentAt,
  formatSentLunchCount,
  formatSentPizzaCount,
  type HistoryRecord,
  toLunchHistoryRecords,
  toPizzaHistoryRecords,
} from "./history/history-utils";

type HistorySectionProps = {
  title: string;
  emptyTitle: string;
  records: HistoryRecord[];
  visibleCount: number;
  sentCount: number;
  query: string;
  showExtraEmail?: boolean;
  onClearSearch: () => void;
};

function StatusChip({ status }: { status: HistoryRecord["status"] }) {
  const sent = status === "sent";

  return (
    <Chip color={sent ? "success" : "default"} size="sm" variant="soft">
      {sent ? "Odesláno" : "Koncept"}
    </Chip>
  );
}

function HistoryEmptyState({
  emptyTitle,
  query,
  onClearSearch,
}: Pick<HistorySectionProps, "emptyTitle" | "query" | "onClearSearch">) {
  const isFiltered = query.trim().length > 0;

  return (
    <EmptyState className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
      <div>
        <Typography weight="semibold">
          {isFiltered ? "Žádné výsledky" : emptyTitle}
        </Typography>
        <Typography.Paragraph color="muted" size="sm">
          {isFiltered
            ? "Pro tento výraz jsme nenašli žádnou objednávku."
            : "Jakmile vznikne první objednávka, objeví se tady."}
        </Typography.Paragraph>
      </div>
      {isFiltered && (
        <Button onPress={onClearSearch} size="sm" variant="tertiary">
          Zrušit hledání
        </Button>
      )}
    </EmptyState>
  );
}

function HistorySection({
  title,
  emptyTitle,
  records,
  visibleCount,
  sentCount,
  query,
  showExtraEmail = false,
  onClearSearch,
}: HistorySectionProps) {
  const countLabel = query.trim()
    ? `${records.length} z ${formatHistoryRecordTotal(visibleCount)}`
    : formatHistoryRecordCount(visibleCount);

  return (
    <Card>
      <Card.Header className="flex-row items-start justify-between gap-4">
        <div>
          <Card.Title>{title}</Card.Title>
          <Card.Description>
            {countLabel} · {sentCount} odesláno
          </Card.Description>
        </div>
      </Card.Header>
      <Card.Content>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label={`Historie: ${title}`}>
              <Table.Header>
                <Table.Column isRowHeader>Datum</Table.Column>
                <Table.Column>Stav</Table.Column>
                <Table.Column className="hidden sm:table-cell">Odesláno</Table.Column>
                <Table.Column className="hidden md:table-cell">Řádků</Table.Column>
                {showExtraEmail && (
                  <Table.Column className="hidden xl:table-cell">Doplňkový e-mail</Table.Column>
                )}
                <Table.Column aria-label="Otevřít" />
              </Table.Header>
              <Table.Body
                items={records}
                renderEmptyState={() => (
                  <HistoryEmptyState
                    emptyTitle={emptyTitle}
                    onClearSearch={onClearSearch}
                    query={query}
                  />
                )}
              >
                {(record) => (
                  <Table.Row
                    href={record.href}
                    id={record.id}
                    textValue={`${formatHistoryDate(record.date)}, ${record.status === "sent" ? "odesláno" : "koncept"}`}
                  >
                    <Table.Cell>{formatHistoryDate(record.date)}</Table.Cell>
                    <Table.Cell>
                      <StatusChip status={record.status} />
                    </Table.Cell>
                    <Table.Cell className="hidden sm:table-cell">
                      {formatHistorySentAt(record.sentAt)}
                    </Table.Cell>
                    <Table.Cell className="hidden md:table-cell">{record.rowCount}</Table.Cell>
                    {showExtraEmail && (
                      <Table.Cell className="hidden xl:table-cell">
                        {record.extraEmail ?? "—"}
                      </Table.Cell>
                    )}
                    <Table.Cell>
                      <IconChevronRight />
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Card.Content>
    </Card>
  );
}

export default function HistoryPage({
  orders,
  pizzaOrders,
  pizzaEnabled = true,
}: {
  orders: OrderSummary[];
  pizzaOrders: PizzaOrderSummary[];
  pizzaEnabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [hideEmpty, setHideEmpty] = useState(true);

  const lunchRecords = toLunchHistoryRecords(orders);
  const pizzaRecords = toPizzaHistoryRecords(pizzaOrders);
  const filteredLunch = filterHistoryRecords(lunchRecords, search, hideEmpty);
  const filteredPizza = filterHistoryRecords(pizzaRecords, search, hideEmpty);
  const lunchSentCount = countSentHistoryRecords(lunchRecords);
  const pizzaSentCount = countSentHistoryRecords(pizzaRecords);

  return (
    <Surface className="k-shell" variant="secondary">
      <header className="shrink-0 px-4 pt-4 md:px-6 md:pt-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Typography.Heading level={1}>Historie objednávek</Typography.Heading>
            <Typography.Paragraph color="muted" size="sm">
              {formatSentLunchCount(lunchSentCount)}
              {pizzaEnabled && ` · ${formatSentPizzaCount(pizzaSentCount)}`}
            </Typography.Paragraph>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
            <Switch isSelected={hideEmpty} onChange={setHideEmpty}>
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Label>Skrýt prázdné koncepty</Label>
              </Switch.Content>
            </Switch>

            <SearchField
              aria-label="Hledat v historii objednávek"
              className="w-full sm:w-80"
              fullWidth
              onChange={setSearch}
              value={search}
              variant="secondary"
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Datum nebo e-mail" />
                <SearchField.ClearButton aria-label="Zrušit hledání" />
              </SearchField.Group>
            </SearchField>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-nav md:p-6">
        <div
          className={`mx-auto grid w-full max-w-6xl gap-4 ${pizzaEnabled ? "xl:grid-cols-2" : ""}`}
        >
          <HistorySection
            emptyTitle="Zatím žádné objednávky obědů"
            onClearSearch={() => setSearch("")}
            query={search}
            records={filteredLunch}
            sentCount={lunchSentCount}
            showExtraEmail
            title="Obědy LIMA"
            visibleCount={countVisibleHistoryRecords(lunchRecords, hideEmpty)}
          />

          {pizzaEnabled && (
            <HistorySection
              emptyTitle="Zatím žádné objednávky pizzy"
              onClearSearch={() => setSearch("")}
              query={search}
              records={filteredPizza}
              sentCount={pizzaSentCount}
              title="Pizza"
              visibleCount={countVisibleHistoryRecords(pizzaRecords, hideEmpty)}
            />
          )}
        </div>
      </main>
    </Surface>
  );
}
