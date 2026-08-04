import {
  Button,
  Card,
  Chip,
  CircleDashedIcon,
  EmptyState,
  IconChevronRight,
  IconSearch,
  Link,
  Table,
  Typography,
  type SortDescriptor,
} from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import {
  formatHistoryDate,
  formatHistoryRowCount,
  formatHistorySentAt,
  type HistoryRecord,
} from "./history-utils";

type HistoryRecordsProps = {
  emptyTitle: string;
  label: string;
  records: HistoryRecord[];
  query: string;
  showExtraEmail?: boolean;
  sortDescriptor: SortDescriptor;
  onClearSearch: () => void;
  onSortChange: (descriptor: SortDescriptor) => void;
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
}: Pick<HistoryRecordsProps, "emptyTitle" | "query" | "onClearSearch">) {
  const isFiltered = query.trim().length > 0;
  const EmptyIcon = isFiltered ? IconSearch : CircleDashedIcon;

  return (
    <EmptyState className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center">
      <EmptyIcon aria-hidden className="size-6 text-muted" />
      <div>
        <Typography weight="semibold">
          {isFiltered ? "Žádné výsledky" : emptyTitle}
        </Typography>
        <Typography.Paragraph color="muted" size="sm">
          {isFiltered
            ? "Tomuto hledání neodpovídá žádná objednávka."
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

function DesktopHistoryTable({
  emptyTitle,
  label,
  records,
  query,
  showExtraEmail,
  sortDescriptor,
  onClearSearch,
  onSortChange,
}: HistoryRecordsProps) {
  return (
    <Table
      className={`hidden min-h-0 max-h-full md:grid ${records.length === 0 ? "min-h-52" : ""}`}
    >
      <Table.ScrollContainer className="max-h-full overflow-y-auto overscroll-contain">
        <Table.Content
          aria-label={`Historie: ${label}`}
          className="min-w-[720px]"
          sortDescriptor={sortDescriptor}
          onSortChange={onSortChange}
        >
          <Table.Header className="sticky top-0 z-10 bg-surface-secondary">
            <Table.Column aria-label="Datum" id="date" allowsSorting isRowHeader>
              {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>
                  Datum
                </Table.SortableColumnHeader>
              )}
            </Table.Column>
            <Table.Column>Stav</Table.Column>
            <Table.Column>Odesláno</Table.Column>
            <Table.Column aria-label="Řádků" id="rowCount" allowsSorting>
              {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>
                  Řádků
                </Table.SortableColumnHeader>
              )}
            </Table.Column>
            {showExtraEmail && <Table.Column>Doplňkový e-mail</Table.Column>}
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
                className="group cursor-pointer"
                href={record.href}
                id={record.id}
                textValue={`${formatHistoryDate(record.date)}, ${record.status === "sent" ? "odesláno" : "koncept"}`}
              >
                <Table.Cell>{formatHistoryDate(record.date)}</Table.Cell>
                <Table.Cell>
                  <StatusChip status={record.status} />
                </Table.Cell>
                <Table.Cell>{formatHistorySentAt(record.sentAt)}</Table.Cell>
                <Table.Cell>{record.rowCount}</Table.Cell>
                {showExtraEmail && <Table.Cell>{record.extraEmail ?? "—"}</Table.Cell>}
                <Table.Cell>
                  <IconChevronRight
                    aria-hidden
                    className="size-4 text-muted group-hover:text-foreground group-focus-visible:text-foreground"
                  />
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function MobileHistoryList({
  emptyTitle,
  records,
  query,
  onClearSearch,
}: Pick<HistoryRecordsProps, "emptyTitle" | "records" | "query" | "onClearSearch">) {
  if (records.length === 0) {
    return (
      <Card className="min-h-52 max-h-full overflow-hidden">
        <HistoryEmptyState
          emptyTitle={emptyTitle}
          onClearSearch={onClearSearch}
          query={query}
        />
      </Card>
    );
  }

  return (
    <Card className="min-h-0 max-h-full gap-0 overflow-hidden p-0">
      <ul className="scrollbar max-h-full divide-y divide-separator-tertiary/50 overflow-y-auto overscroll-contain">
        {records.map((record) => (
          <li key={record.id}>
            <Link
              aria-label={`Otevřít objednávku z ${formatHistoryDate(record.date)}`}
              className={buttonVariants({
                className:
                  "group h-auto min-h-20 justify-start rounded-none px-4 py-3 text-start whitespace-normal",
                fullWidth: true,
                variant: "ghost",
              })}
              href={record.href}
            >
              <span className="min-w-0 flex-1">
                <span className="mb-1 flex items-center gap-2">
                  <span className="font-medium">{formatHistoryDate(record.date)}</span>
                  <StatusChip status={record.status} />
                </span>
                <span className="block truncate text-sm text-muted">
                  {formatHistoryRowCount(record.rowCount)} · {formatHistorySentAt(record.sentAt)}
                </span>
                {record.extraEmail && (
                  <span className="block truncate text-sm text-muted">{record.extraEmail}</span>
                )}
              </span>
              <IconChevronRight
                aria-hidden
                className="size-4 shrink-0 text-muted group-hover:text-foreground group-focus-visible:text-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function HistoryRecords(props: HistoryRecordsProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DesktopHistoryTable {...props} />
      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <MobileHistoryList {...props} />
      </div>
    </div>
  );
}
