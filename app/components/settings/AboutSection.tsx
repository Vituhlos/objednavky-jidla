"use client";

import { useState } from "react";
import { RELEASE_NOTES } from "@/lib/release-notes";
import { getAppVersionInfo } from "@/lib/version";
import MIcon from "../MIcon";
import { CHANNEL_LABELS, RELEASE_SECTION_LABELS } from "./constants";
import { formatBuildDate } from "./settings-utils";
import { SettingsSection, VersionMeta } from "./SettingsPrimitives";

const VERSION_INFO = getAppVersionInfo();

/**
 * Verze, release kanál a diagnostika běžícího buildu.
 *
 * „Kopírovat diagnostiku" sesype dohromady i věci, které zná jen prohlížeč
 * (URL, časové pásmo, user agent) — při hlášení problému je to přesně to,
 * na co by se jinak muselo doptávat.
 */
export function AboutSection({ isActive }: { isActive: boolean }) {
  const [versionCopied, setVersionCopied] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  const getSupportInfoText = () => [
    `${VERSION_INFO.name} v${VERSION_INFO.version}`,
    `Channel: ${VERSION_INFO.releaseChannel}`,
    `Commit: ${VERSION_INFO.commitSha || "unknown"}`,
    `Build date: ${VERSION_INFO.buildDate || "unknown"}`,
    `Git ref: ${VERSION_INFO.gitRef || "unknown"}`,
    `Docker tag: ${VERSION_INFO.dockerTag || "unknown"}`,
    `App URL: ${typeof window !== "undefined" ? window.location.origin : "unknown"}`,
    `Client time: ${new Date().toISOString()}`,
    `Client timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown"}`,
    `User agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "unknown"}`,
  ].join("\n");

  if (!isActive) return null;

  return (
    <>
                <SettingsSection icon="info" title="O aplikaci" action={
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {CHANNEL_LABELS[VERSION_INFO.releaseChannel] ?? VERSION_INFO.releaseChannel}
                  </span>
                }>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-display font-bold text-[18px] text-stone-900">{VERSION_INFO.name}</p>
                        <p className="text-[12.5px] text-stone-500">Produktová verze, release kanál a diagnostika aktuálně běžícího buildu.</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          className="modal-btn modal-btn--secondary"
                          onClick={() => setShowReleaseNotes(true)}
                          type="button"
                        >
                          Novinky
                        </button>
                        <button
                          className="modal-btn modal-btn--secondary"
                          onClick={async () => {
                            await navigator.clipboard?.writeText(getSupportInfoText());
                            setVersionCopied(true);
                            setTimeout(() => setVersionCopied(false), 1800);
                          }}
                          type="button"
                        >
                          {versionCopied ? "Zkopírováno" : "Kopírovat diagnostiku"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      <VersionMeta label="Verze" value={`v${VERSION_INFO.version}`} mono unavailable="Bez verze" />
                      <VersionMeta label="Kanál" value={CHANNEL_LABELS[VERSION_INFO.releaseChannel] ?? VERSION_INFO.releaseChannel} unavailable="Lokální vývoj" />
                      <VersionMeta label="Build" value={VERSION_INFO.buildDate ? formatBuildDate(VERSION_INFO.buildDate) : ""} unavailable="Lokální vývoj" />
                      <VersionMeta label="Commit" value={VERSION_INFO.shortCommitSha || VERSION_INFO.commitSha} mono />
                      <VersionMeta label="Git ref" value={VERSION_INFO.gitRef} mono />
                      <VersionMeta label="Image" value={VERSION_INFO.dockerTag} mono unavailable="Mimo Docker release" />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[12px]">
                      <a className="inline-flex items-center gap-1.5 font-semibold px-3 py-2 rounded-2xl glass-btn text-stone-600" href="/api/version" rel="noreferrer" target="_blank">
                        <MIcon name="info" size={14} /> JSON diagnostika
                      </a>
                      <span className="text-stone-400">Technický endpoint pro podporu, monitoring a ověření nasazené verze.</span>
                    </div>
                  </div>
                </SettingsSection>

                {showReleaseNotes && (
                  <div className="modal-overlay" onClick={() => setShowReleaseNotes(false)}>
                    <div className="modal-sheet" role="dialog" aria-modal="true" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
                      <div className="modal-sheet__header">
                        <h3 className="modal-sheet__title">Co je nového</h3>
                        <button aria-label="Zavřít" className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 text-lg font-bold" onClick={() => setShowReleaseNotes(false)} type="button">×</button>
                      </div>
                      <div className="modal-sheet__body space-y-4">
                        {RELEASE_NOTES.map((note) => (
                          <div key={note.version} className="glass-soft rounded-2xl p-4 flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-display font-bold text-[15px] text-stone-900">{note.version === "Unreleased" ? "Připravuje se" : `v${note.version}`}</p>
                                <p className="text-[12px] text-stone-500">{note.title}</p>
                              </div>
                              {note.date && <span className="text-[11px] text-stone-400 font-mono">{note.date}</span>}
                            </div>
                            {note.sections.map((section) => (
                              <div key={`${note.version}-${section.title}`} className="flex flex-col gap-1">
                                <p className="text-[11px] font-bold uppercase text-amber-700">{RELEASE_SECTION_LABELS[section.title] ?? section.title}</p>
                                <ul className="space-y-1">
                                  {section.items.map((item) => (
                                    <li key={item} className="text-[12.5px] text-stone-600 leading-relaxed flex gap-2">
                                      <span className="text-amber-500 mt-0.5">•</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
    </>
  );
}
