import {
  Card,
  Skeleton,
  Surface,
  Table,
  Typography,
} from "@heroui/react";

const loadingRows = [0, 1, 2, 3, 4, 5];

function DesktopLoadingTable() {
  return (
    <Table className="hidden min-h-0 flex-1 md:grid">
      <Table.ScrollContainer className="h-full overflow-y-auto">
        <Table.Content aria-label="Načítání historie objednávek" className="min-w-[720px]">
          <Table.Header className="sticky top-0 z-10 bg-surface-secondary">
            <Table.Column isRowHeader>Datum</Table.Column>
            <Table.Column>Stav</Table.Column>
            <Table.Column>Odesláno</Table.Column>
            <Table.Column>Řádků</Table.Column>
            <Table.Column>Doplňkový e-mail</Table.Column>
            <Table.Column aria-label="Otevřít" />
          </Table.Header>
          <Table.Body>
            {loadingRows.map((row) => (
              <Table.Row id={row} key={row}>
                <Table.Cell>
                  <Skeleton className="h-4 w-24 rounded" />
                </Table.Cell>
                <Table.Cell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </Table.Cell>
                <Table.Cell>
                  <Skeleton className="h-4 w-28 rounded" />
                </Table.Cell>
                <Table.Cell>
                  <Skeleton className="h-4 w-8 rounded" />
                </Table.Cell>
                <Table.Cell>
                  <Skeleton className="h-4 w-40 rounded" />
                </Table.Cell>
                <Table.Cell />
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function MobileLoadingList() {
  return (
    <Card className="min-h-0 max-h-full gap-0 overflow-hidden p-0 md:hidden">
      {loadingRows.map((row) => (
        <div
          className="flex min-h-20 items-center gap-3 border-b border-separator-tertiary/50 px-4 py-3 last:border-b-0"
          key={row}
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-44 rounded" />
          </div>
          <Skeleton className="size-4 rounded" />
        </div>
      ))}
    </Card>
  );
}

export default function HistoryLoading() {
  return (
    <Surface className="k-shell">
      <main
        aria-busy="true"
        aria-label="Načítání historie objednávek"
        className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4 pb-nav md:px-6 md:pt-6"
      >
        <div className="skeleton--shimmer mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 overflow-hidden">
          <header className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Typography.Heading level={1}>Historie objednávek</Typography.Heading>
              <Skeleton animationType="none" className="mt-1 h-4 w-36 rounded" />
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
              <Skeleton animationType="none" className="h-8 w-48 rounded-full" />
              <Skeleton animationType="none" className="h-10 w-full rounded-3xl sm:w-80" />
            </div>
          </header>

          <Skeleton animationType="none" className="h-4 w-32 shrink-0 rounded" />
          <DesktopLoadingTable />
          <MobileLoadingList />
        </div>
      </main>
    </Surface>
  );
}
