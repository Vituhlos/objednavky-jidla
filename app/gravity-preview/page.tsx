"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Label,
  Modal,
  Select,
  Text,
  TextArea,
  TextInput,
} from "@gravity-ui/uikit";

const SOUP_OPTIONS = [
  { value: "", content: "Vybrat polévku" },
  { value: "1", content: "1 — Hovězí vývar" },
  { value: "2", content: "2 — Zelňačka" },
];

const MEAL_OPTIONS = [
  { value: "", content: "Vybrat jídlo" },
  { value: "1", content: "1 — Svíčková na smetaně" },
  { value: "2", content: "2 — Vepřový guláš" },
  { value: "10", content: "10 — Masová směs Flamendr" },
];

export default function GravityPreviewPage() {
  const [soup, setSoup] = useState<string[]>([""]);
  const [meal, setMeal] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
      <Text variant="header-1">Gravity UI — sandbox</Text>
      <Text color="secondary" style={{ display: "block", marginTop: 8, marginBottom: 24 }}>
        Izolovaná ukázka komponent pro migraci Kantýny. Produkční stránky zatím beze změny.
      </Text>

      <Card view="outlined" style={{ padding: 20, marginBottom: 16 }}>
        <Text variant="subheader-2">Modal objednávky (náhled)</Text>
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <div>
            <Label>Jméno</Label>
            <div style={{ marginTop: 4 }}>
              <TextInput placeholder="Jan" size="l" />
            </div>
          </div>
          <div>
            <Label>Příjmení</Label>
            <div style={{ marginTop: 4 }}>
              <TextInput placeholder="Novák" size="l" />
            </div>
          </div>
          <div>
            <Label>Polévka</Label>
            <div style={{ marginTop: 4 }}>
              <Select
                filterable
                options={SOUP_OPTIONS}
                placeholder="Vybrat polévku"
                size="l"
                value={soup}
                onUpdate={setSoup}
                width="max"
              />
            </div>
          </div>
          <div>
            <Label>Jídlo</Label>
            <div style={{ marginTop: 4 }}>
              <Select
                filterable
                options={MEAL_OPTIONS}
                placeholder="Vybrat jídlo"
                size="l"
                value={meal}
                onUpdate={setMeal}
                width="max"
              />
            </div>
          </div>
          <div>
            <Label>Poznámka</Label>
            <div style={{ marginTop: 4 }}>
              <TextArea
                placeholder="např. bez špenátu…"
                rows={2}
                value={note}
                onUpdate={setNote}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button view="flat" size="l" onClick={() => setOpen(true)}>
              Náhled modalu
            </Button>
            <Button view="outlined" size="l">
              Zrušit
            </Button>
            <Button view="action" size="l">
              Uložit
            </Button>
          </div>
        </div>
      </Card>

      <Card view="outlined" style={{ padding: 20 }}>
        <Text variant="subheader-2">Stavový banner (náhled)</Text>
        <div
          style={{
            marginTop: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid rgba(34,197,94,0.3)",
            background: "rgba(34,197,94,0.07)",
          }}
        >
          <Text color="positive">
            <strong>Objednávka odeslána</strong> v 08:15 · Další úpravy nejsou možné.
          </Text>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)}>
        <Text variant="header-2">Přidat objednávku</Text>
        <Text style={{ marginTop: 8 }}>
          Ukázka Gravity Modal — při migraci nahradí vlastní modal-sheet.
        </Text>
        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button view="outlined" onClick={() => setOpen(false)}>
            Zavřít
          </Button>
        </div>
      </Modal>
    </div>
  );
}
