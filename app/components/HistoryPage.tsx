import type { OrderSummary } from "@/lib/orders";
import type { PizzaOrderSummary } from "@/lib/pizza";
import Link from "next/link";
import AppTopBar from "./AppTopBar";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatSentAt(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage({
  orders,
  pizzaOrders,
}: {
  orders: OrderSummary[];
  pizzaOrders: PizzaOrderSummary[];
}) {
  const sentCount = orders.filter((o) => o.status === "sent").length;
  const pizzaSentCount = pizzaOrders.filter((o) => o.status === "sent").length;

  return (
    <div className="v2-shell">
      <AppTopBar />

      {/* ── Infostrip ── */}
      <div className="v2-infostrip">
        <div className="v2-infostrip__facts">
          <span style={{ fontWeight: 700, color: "var(--v2-text)", fontSize: "0.95rem" }}>
            Historie objednávek
          </span>
          <span className="v2-fact">
            <strong>{sentCount}</strong> odeslaných obědů
          </span>
          <span className="v2-fact">
            <strong>{pizzaSentCount}</strong> odeslaných pizz
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="v2-content">
        {/* LIMA orders */}
        <section className="v2-dept">
          <div className="v2-dept__head">
            <div>
              <h2 className="v2-dept__title">Obědy LIMA</h2>
              <span className="v2-dept__count">
                {orders.length} záznamů · {sentCount} odesláno
              </span>
            </div>
          </div>
          {orders.length === 0 ? (
            <div className="v2-empty-state">Zatím žádné objednávky v databázi.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="v2-history-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Stav</th>
                    <th>Odesláno</th>
                    <th>Řádků</th>
                    <th>Doplňkový e-mail</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 600 }}>{formatDate(order.date)}</td>
                      <td>
                        <span className={`v2-badge v2-badge--${order.status}`}>
                          {order.status === "sent" ? "Odesláno" : "Koncept"}
                        </span>
                      </td>
                      <td className="v2-td-muted">{formatSentAt(order.sentAt)}</td>
                      <td className="v2-td-muted">{order.rowCount}</td>
                      <td className="v2-td-muted">{order.extraEmail ?? "–"}</td>
                      <td>
                        <Link className="v2-detail-link" href={`/historie/${order.id}`}>
                          Detail →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Pizza orders */}
        <section className="v2-dept">
          <div className="v2-dept__head">
            <div>
              <h2 className="v2-dept__title">Pizza</h2>
              <span className="v2-dept__count">
                {pizzaOrders.length} záznamů · {pizzaSentCount} odesláno
              </span>
            </div>
          </div>
          {pizzaOrders.length === 0 ? (
            <div className="v2-empty-state">Zatím žádné pizzové objednávky v databázi.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="v2-history-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Stav</th>
                    <th>Odesláno</th>
                    <th>Řádků</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pizzaOrders.map((order) => (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 600 }}>{formatDate(order.date)}</td>
                      <td>
                        <span className={`v2-badge v2-badge--${order.status}`}>
                          {order.status === "sent" ? "Odesláno" : "Koncept"}
                        </span>
                      </td>
                      <td className="v2-td-muted">{formatSentAt(order.sentAt)}</td>
                      <td className="v2-td-muted">{order.rowCount}</td>
                      <td>
                        <Link className="v2-detail-link" href={`/historie/pizza/${order.id}`}>
                          Detail →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
