"use client";

import { useState } from "react";
import {
  Label,
  SearchField,
  Surface,
  Switch,
  Tabs,
  Toolbar,
  Typography,
  type SortDescriptor,
} from "@heroui/react";
import type { OrderSummary } from "@/lib/orders";
import type { PizzaOrderSummary } from "@/lib/pizza";
import { HistoryRecords } from "./history/history-records";
import {
  countSentHistoryRecords,
  countVisibleHistoryRecords,
  filterHistoryRecords,
  formatHistoryRecordCount,
  formatHistoryRecordTotal,
  formatSentLunchCount,
  formatSentPizzaCount,
  sortHistoryRecords,
  toLunchHistoryRecords,
  toPizzaHistoryRecords,
} from "./history/history-utils";

type HistoryKind = "lunch" | "pizza";

type HistoryCollectionProps = {
  ariaLabel: string;
  emptyTitle: string;
  label: string;
  query: string;
  records: ReturnType<typeof toLunchHistoryRecords>;
  resultLabel: string;
  sentCount: number;
  showExtraEmail?: boolean;
  sortDescriptor: SortDescriptor;
  onClearSearch: () => void;
  onSortChange: (descriptor: SortDescriptor) => void;
};

function HistoryCollection({
  ariaLabel,
  emptyTitle,
  label,
  query,
  records,
  resultLabel,
  sentCount,
  showExtraEmail,
  sortDescriptor,
  onClearSearch,
  onSortChange,
}: HistoryCollectionProps) {
  return (
    <section aria-label={ariaLabel} className="flex h-full min-h-0 flex-col gap-2">
      <Typography.Paragraph aria-live="polite" color="muted" size="sm">
        {resultLabel} · {sentCount} odesláno
      </Typography.Paragraph>
      <HistoryRecords
        emptyTitle={emptyTitle}
        label={label}
        onClearSearch={onClearSearch}
        onSortChange={onSortChange}
        query={query}
        records={records}
        showExtraEmail={showExtraEmail}
        sortDescriptor={sortDescriptor}
      />
    </section>
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
  const [selectedKind, setSelectedKind] = useState<HistoryKind>("lunch");
  const [search, setSearch] = useState("");
  const [hideEmpty, setHideEmpty] = useState(true);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "date",
    direction: "descending",
  });

  const lunchRecords = toLunchHistoryRecords(orders);
  const pizzaRecords = toPizzaHistoryRecords(pizzaOrders);
  const lunchSentCount = countSentHistoryRecords(lunchRecords);
  const pizzaSentCount = countSentHistoryRecords(pizzaRecords);
  const lunchVisibleCount = countVisibleHistoryRecords(lunchRecords, hideEmpty);
  const pizzaVisibleCount = countVisibleHistoryRecords(pizzaRecords, hideEmpty);
  const filteredLunch = sortHistoryRecords(
    filterHistoryRecords(lunchRecords, search, hideEmpty),
    sortDescriptor,
  );
  const filteredPizza = sortHistoryRecords(
    filterHistoryRecords(pizzaRecords, search, hideEmpty),
    sortDescriptor,
  );

  function resultLabel(resultCount: number, visibleCount: number) {
    return search.trim()
      ? `${resultCount} z ${formatHistoryRecordTotal(visibleCount)}`
      : formatHistoryRecordCount(visibleCount);
  }

  return (
    <Surface className="k-shell">
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4 pb-nav md:px-6 md:pt-6">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4">
          <header className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Typography.Heading level={1}>Historie objednávek</Typography.Heading>
              <Typography.Paragraph color="muted" size="sm">
                {formatSentLunchCount(lunchSentCount)}
                {pizzaEnabled && ` · ${formatSentPizzaCount(pizzaSentCount)}`}
              </Typography.Paragraph>
            </div>

            <Toolbar
              aria-label="Nástroje historie objednávek"
              className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center lg:w-auto"
            >
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
            </Toolbar>
          </header>

          {pizzaEnabled ? (
            <Tabs
              className="min-h-0 flex-1 gap-3"
              selectedKey={selectedKind}
              onSelectionChange={(key) => setSelectedKind(key as HistoryKind)}
            >
              <Tabs.ListContainer className="w-fit max-w-full shrink-0">
                <Tabs.List aria-label="Typ objednávky">
                  <Tabs.Tab id="lunch">
                    Obědy · {lunchVisibleCount}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="pizza">
                    Pizza · {pizzaVisibleCount}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>

              <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="lunch">
                <HistoryCollection
                  ariaLabel="Objednávky obědů"
                  emptyTitle="Zatím žádné objednávky obědů"
                  label="Obědy"
                  onClearSearch={() => setSearch("")}
                  onSortChange={setSortDescriptor}
                  query={search}
                  records={filteredLunch}
                  resultLabel={resultLabel(filteredLunch.length, lunchVisibleCount)}
                  sentCount={lunchSentCount}
                  showExtraEmail
                  sortDescriptor={sortDescriptor}
                />
              </Tabs.Panel>

              <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="pizza">
                <HistoryCollection
                  ariaLabel="Objednávky pizzy"
                  emptyTitle="Zatím žádné objednávky pizzy"
                  label="Pizza"
                  onClearSearch={() => setSearch("")}
                  onSortChange={setSortDescriptor}
                  query={search}
                  records={filteredPizza}
                  resultLabel={resultLabel(filteredPizza.length, pizzaVisibleCount)}
                  sentCount={pizzaSentCount}
                  sortDescriptor={sortDescriptor}
                />
              </Tabs.Panel>
            </Tabs>
          ) : (
            <div className="min-h-0 flex-1">
              <HistoryCollection
                ariaLabel="Objednávky obědů"
                emptyTitle="Zatím žádné objednávky obědů"
                label="Obědy"
                onClearSearch={() => setSearch("")}
                onSortChange={setSortDescriptor}
                query={search}
                records={filteredLunch}
                resultLabel={resultLabel(filteredLunch.length, lunchVisibleCount)}
                sentCount={lunchSentCount}
                showExtraEmail
                sortDescriptor={sortDescriptor}
              />
            </div>
          )}
        </div>
      </main>
    </Surface>
  );
}
