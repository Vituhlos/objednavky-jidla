"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Label,
  Modal,
  NumberInput,
  Select,
  Text,
  TextArea,
  TextInput,
} from "@gravity-ui/uikit";
import MIcon from "./MIcon";
import "@gravity-ui/uikit/styles/fonts.css";
import "@gravity-ui/uikit/styles/styles.css";
import "./order-edit-modal.css";
import type { MealEntry, MenuItem, OrderRowEnriched } from "@/lib/types";
import type { ExtrasPrices } from "@/lib/pricing";
import { GravityRoot } from "@/components/gravity";
import {
  idToSelectValue,
  menuItemsToSelectOptions,
  selectValueToId,
} from "@/components/gravity/menuSelectUtils";
import { ConfirmModal } from "./ConfirmModal";

export type RowUpdates = Partial<{
  personName: string;
  soupItemId: number | null;
  soupItemId2: number | null;
  mainItemId: number | null;
  mealCount: number;
  extraMeals: MealEntry[];
  rollCount: number;
  breadDumplingCount: number;
  potatoDumplingCount: number;
  ketchupCount: number;
  tatarkaCount: number;
  bbqCount: number;
  note: string;
}>;

type Props = {
  row: OrderRowEnriched;
  soups: MenuItem[];
  meals: MenuItem[];
  isNew: boolean;
  defaultSoupPrice?: number;
  defaultMealPrice?: number;
  ep: ExtrasPrices;
  existingNames: string[];
  onSave: (u: RowUpdates) => void;
  onClose: () => void;
  onDelete: () => void;
};

function ExtraStepper({
  label,
  price,
  value,
  onChange,
}: {
  label: string;
  price: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <NumberInput
      label={`${label} (${price} Kč/ks)`}
      min={0}
      size="l"
      value={value}
      onUpdate={(v) => onChange(Math.max(0, v ?? 0))}
    />
  );
}

export function OrderEditModal({
  row,
  soups,
  meals,
  isNew,
  defaultSoupPrice,
  defaultMealPrice,
  ep,
  existingNames,
  onSave,
  onClose,
  onDelete,
}: Props) {
  const [firstName, setFirstName] = useState(() => {
    if (row.personName) return row.personName.trim().split(/\s+/)[0] ?? "";
    try { return localStorage.getItem("lastFirstName") ?? ""; } catch { return ""; }
  });
  const [lastName, setLastName] = useState(() => {
    if (row.personName) return row.personName.trim().split(/\s+/).slice(1).join(" ");
    try { return localStorage.getItem("lastLastName") ?? ""; } catch { return ""; }
  });
  const personName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const [soupIds, setSoupIds] = useState<(number | null)[]>(
    row.soupItemId2 != null ? [row.soupItemId, row.soupItemId2] : [row.soupItemId]
  );
  const [mealEntries, setMealEntries] = useState<{ itemId: number | null; count: number }[]>([
    { itemId: row.mainItemId, count: row.mealCount || 1 },
    ...row.extraMealItems.map((e) => ({ itemId: e.item.id, count: e.count })),
  ]);
  const [rollCount, setRollCount] = useState(row.rollCount);
  const [breadDumplingCount, setBreadDumplingCount] = useState(row.breadDumplingCount);
  const [potatoDumplingCount, setPotatoDumplingCount] = useState(row.potatoDumplingCount);
  const [ketchupCount, setKetchupCount] = useState(row.ketchupCount);
  const [tatarkaCount, setTatarkaCount] = useState(row.tatarkaCount);
  const [bbqCount, setBbqCount] = useState(row.bbqCount);
  const [note, setNote] = useState(row.note);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const soupOptions = useMemo(() => menuItemsToSelectOptions(soups), [soups]);
  const mealOptions = useMemo(() => menuItemsToSelectOptions(meals), [meals]);

  const handleCancel = () => { if (isNew) onDelete(); else onClose(); };

  const hasFood =
    soupIds.some((id) => id != null) ||
    mealEntries.some((e) => e.itemId != null) ||
    rollCount > 0 || breadDumplingCount > 0 || potatoDumplingCount > 0;

  const normalizeName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const isDuplicateName =
    personName.trim() !== "" &&
    normalizeName(personName) !== normalizeName(row.personName) &&
    existingNames.some((n) => normalizeName(n) === normalizeName(personName));
  const showMealTip = /\d/.test(lastName) || /\d/.test(firstName);
  const firstNameInvalid = /\d/.test(firstName);
  const lastNameInvalid = /\d/.test(lastName);

  const handleSave = () => {
    if (!firstName.trim()) {
      setValidationError("Zadejte křestní jméno.");
      return;
    }
    if (!lastName.trim()) {
      setValidationError("Zadejte příjmení.");
      return;
    }
    if (!hasFood) {
      setValidationError("Vyberte alespoň jedno jídlo nebo přílohu.");
      return;
    }
    if (isDuplicateName) {
      setValidationError(`„${personName.trim()}" už v objednávce je.`);
      return;
    }
    setValidationError(null);
    try {
      localStorage.setItem("lastFirstName", firstName.trim());
      localStorage.setItem("lastLastName", lastName.trim());
    } catch { /* */ }
    const firstMeal = mealEntries[0] ?? { itemId: null, count: 1 };
    const extraMeals: MealEntry[] = mealEntries
      .slice(1)
      .filter((e) => e.itemId != null)
      .map((e) => ({ itemId: e.itemId!, count: e.count }));
    onSave({
      personName,
      soupItemId: soupIds[0] ?? null,
      soupItemId2: soupIds.length > 1 ? (soupIds[1] ?? null) : null,
      mainItemId: firstMeal.itemId,
      mealCount: firstMeal.count,
      extraMeals,
      rollCount,
      breadDumplingCount,
      potatoDumplingCount,
      ketchupCount,
      tatarkaCount,
      bbqCount,
      note,
    });
  };

  if (!mounted) return null;

  return (
    <GravityRoot>
      <Modal
        aria-labelledby="edit-modal-title"
        contentClassName="order-edit-modal"
        open
        onOpenChange={(open) => { if (!open) handleCancel(); }}
      >
        <div className="order-edit-modal__header">
          <Text id="edit-modal-title" variant="header-1">
            {isNew ? "Přidat objednávku" : "Upravit objednávku"}
          </Text>
          <Button
            aria-label="Zavřít"
            onClick={handleCancel}
            size="l"
            view="flat"
          >
            <MIcon name="close" size={18} />
          </Button>
        </div>

        <div className="order-edit-modal__body">
          <div className="order-edit-modal__row-2">
            <div>
              <Label>Jméno</Label>
              <TextInput
                autoFocus
                autoComplete="given-name"
                placeholder="Jan"
                size="l"
                validationState={firstNameInvalid ? "invalid" : undefined}
                value={firstName}
                onUpdate={(v) => { setFirstName(v); setValidationError(null); }}
              />
              {firstNameInvalid && (
                <Text color="danger" variant="caption-2">Odstraň číslo ze jména.</Text>
              )}
            </div>
            <div>
              <Label>Příjmení</Label>
              <TextInput
                autoComplete="family-name"
                placeholder="Novák"
                size="l"
                validationState={lastNameInvalid ? "invalid" : undefined}
                value={lastName}
                onUpdate={(v) => { setLastName(v); setValidationError(null); }}
              />
              {lastNameInvalid && (
                <Text color="danger" variant="caption-2">Odstraň číslo z příjmení.</Text>
              )}
            </div>
          </div>

          {isDuplicateName && (
            <Text color="warning" variant="body-2">
              <MIcon name="warning" size={14} /> Toto jméno už v objednávce je.
            </Text>
          )}

          {soupIds.map((soupId, idx) => (
            <div key={`soup-${idx}`}>
              <div className="order-edit-modal__field-head">
                <Label>
                  {idx === 0 ? "Polévka" : "Druhá polévka"}
                  {defaultSoupPrice != null && (
                    <span className="order-edit-modal__price"> {defaultSoupPrice} Kč</span>
                  )}
                </Label>
                {idx > 0 && (
                  <Button
                    size="s"
                    view="flat-danger"
                    onClick={() => setSoupIds((prev) => prev.slice(0, -1))}
                  >
                    × odebrat
                  </Button>
                )}
              </div>
              <Select
                filterable
                hasClear
                id={`modal-soup-${idx}`}
                options={soupOptions}
                placeholder="Vybrat polévku"
                size="l"
                value={idToSelectValue(soupId)}
                width="max"
                onUpdate={(val) =>
                  setSoupIds((prev) => prev.map((id, i) => (i === idx ? selectValueToId(val) : id)))
                }
              />
            </div>
          ))}

          {soupIds.length < 2 && soupIds[0] != null && (
            <Button
              size="m"
              view="outlined"
              onClick={() => setSoupIds((prev) => [...prev, null])}
            >
              <MIcon name="add" size={14} /> Přidat druhou polévku
            </Button>
          )}

          {mealEntries.map((entry, idx) => (
            <div key={`meal-${idx}`}>
              <div className="order-edit-modal__field-head">
                <Label>
                  {idx === 0 ? "Jídlo" : `Jídlo ${idx + 1}`}
                  {defaultMealPrice != null && (
                    <span className="order-edit-modal__price"> {defaultMealPrice} Kč</span>
                  )}
                </Label>
                {idx > 0 && (
                  <Button
                    size="s"
                    view="flat-danger"
                    onClick={() => setMealEntries((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    × odebrat
                  </Button>
                )}
              </div>
              <div className="order-edit-modal__meal-row">
                <Select
                  filterable
                  hasClear
                  id={`modal-meal-${idx}`}
                  options={mealOptions}
                  placeholder="Vybrat jídlo"
                  size="l"
                  value={idToSelectValue(entry.itemId)}
                  width="max"
                  onUpdate={(val) =>
                    setMealEntries((prev) =>
                      prev.map((ent, i) =>
                        i === idx ? { ...ent, itemId: selectValueToId(val) } : ent
                      )
                    )
                  }
                />
                {entry.itemId != null && (
                  <div className="order-edit-modal__meal-count">
                    <NumberInput
                      min={1}
                      max={10}
                      size="l"
                      value={entry.count}
                      onUpdate={(v) =>
                        setMealEntries((prev) =>
                          prev.map((ent, i) =>
                            i === idx
                              ? { ...ent, count: Math.min(10, Math.max(1, v ?? 1)) }
                              : ent
                          )
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          {mealEntries[0]?.itemId != null && (
            <div style={{ position: "relative" }}>
              {showMealTip && (
                <div className="order-edit-modal__tip" role="note">
                  Víc jídel pro sebe? Přidej je sem — není třeba nová objednávka.
                </div>
              )}
              <Button
                size="m"
                view={showMealTip ? "outlined-danger" : "outlined"}
                onClick={() => setMealEntries((prev) => [...prev, { itemId: null, count: 1 }])}
              >
                <MIcon name="add" size={14} /> Přidat další jídlo do objednávky
              </Button>
            </div>
          )}

          <div>
            <Label>Poznámka k jídlu</Label>
            <TextArea
              controlProps={{ maxLength: 120 }}
              id="modal-note"
              maxRows={4}
              minRows={2}
              placeholder="např. bez špenátu, bez zelí..."
              value={note}
              onUpdate={setNote}
            />
          </div>

          <div className="order-edit-modal__extras">
            <Text variant="subheader-2">Přílohy a doplňky</Text>
            <ExtraStepper label="Houska" onChange={setRollCount} price={ep.roll} value={rollCount} />
            <ExtraStepper label="Houskový knedlík" onChange={setBreadDumplingCount} price={ep.breadDumpling} value={breadDumplingCount} />
            <ExtraStepper label="Bramborový knedlík" onChange={setPotatoDumplingCount} price={ep.potatoDumpling} value={potatoDumplingCount} />
            <ExtraStepper label="Kečup" onChange={setKetchupCount} price={ep.ketchup} value={ketchupCount} />
            <ExtraStepper label="Tatarka" onChange={setTatarkaCount} price={ep.tatarka} value={tatarkaCount} />
            <ExtraStepper label="BBQ omáčka" onChange={setBbqCount} price={ep.bbq} value={bbqCount} />
          </div>
        </div>

        {validationError && (
          <div style={{ padding: "0 20px 8px" }} role="alert">
            <Text color="danger" variant="body-2">
              <MIcon name="warning" size={14} /> {validationError}
            </Text>
          </div>
        )}

        <div className="order-edit-modal__footer">
          {!isNew && (
            <Button view="outlined-danger" onClick={() => setShowDeleteConfirm(true)}>
              Smazat
            </Button>
          )}
          <div style={{ flex: 1 }} />
          <Button view="outlined" size="l" onClick={handleCancel}>
            Zrušit
          </Button>
          <Button
            disabled={isDuplicateName || showMealTip}
            size="l"
            view="action"
            onClick={handleSave}
          >
            Uložit
          </Button>
        </div>
      </Modal>

      {showDeleteConfirm && (
        <ConfirmModal
          message="Objednávka této osoby bude odstraněna."
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={onDelete}
          title="Smazat objednávku"
        />
      )}
    </GravityRoot>
  );
}
