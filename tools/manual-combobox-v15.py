from pathlib import Path

client = Path('src/features/game-finder/GameFinderClient.tsx')
text = client.read_text(encoding='utf-8')

text = text.replace('  CheckCircle2,\n  Gamepad2,', '  CheckCircle2,\n  ChevronDown,\n  Gamepad2,', 1)

old = '''type ManualSearchState = {
  cpu: string;
  gpu: string;
  ram: string;
  os: string;
};

'''
assert text.count(old) == 1
text = text.replace(old, '', 1)

old = '''function emptyManualSearch(): ManualSearchState {
  return { cpu: "", gpu: "", ram: "", os: "" };
}

'''
assert text.count(old) == 1
text = text.replace(old, '', 1)

start = text.index('function SearchableManualSelect({')
end = text.index('\nfunction nowIso()', start)
new_component = '''function SearchableManualSelect({
  fieldId,
  label,
  searchPlaceholder,
  emptyLabel,
  options,
  value,
  onValueChange,
}: {
  fieldId: string;
  label: string;
  searchPlaceholder: string;
  emptyLabel: string;
  options: ManualSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );
  const visibleOptions = useMemo(
    () => filterManualOptions(options, searchValue, value),
    [options, searchValue, value]
  );
  const matchCount = searchValue.trim()
    ? options.filter((option) => manualOptionMatches(option, searchValue)).length
    : options.length;

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    function handleOutsidePointer(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setSearchValue("");
      }
    }

    window.addEventListener("pointerdown", handleOutsidePointer);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [open]);

  function closePicker(returnFocus = false) {
    setOpen(false);
    setSearchValue("");
    if (returnFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  function selectOption(nextValue: string) {
    onValueChange(nextValue);
    closePicker(true);
  }

  function focusOption(current: HTMLElement, direction: 1 | -1) {
    const optionNodes = Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>("[data-manual-option]") ?? []
    );
    const index = optionNodes.indexOf(current as HTMLButtonElement);
    if (index < 0 || optionNodes.length === 0) return;
    const nextIndex = (index + direction + optionNodes.length) % optionNodes.length;
    optionNodes[nextIndex]?.focus();
  }

  return (
    <div ref={rootRef} className={styles.configField}>
      <span id={`${fieldId}-label`} className={styles.configFieldLabel}>{label}</span>

      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        className={`${styles.configPickerTrigger} ${open ? styles.configPickerTriggerOpen : ""}`}
        aria-labelledby={`${fieldId}-label ${fieldId}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${fieldId}-listbox`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span
          id={`${fieldId}-value`}
          className={selectedOption ? styles.configPickerValue : styles.configPickerPlaceholder}
        >
          {selectedOption?.label ?? emptyLabel}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.configPickerMenu}>
          <div className={styles.configPickerSearch}>
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              role="combobox"
              value={searchValue}
              placeholder={searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
              aria-label={`Buscar ${label.toLocaleLowerCase("es")}`}
              aria-controls={`${fieldId}-listbox`}
              aria-expanded="true"
              aria-autocomplete="list"
              onChange={(event) => setSearchValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  closePicker(true);
                  return;
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  rootRef.current
                    ?.querySelector<HTMLButtonElement>("[data-manual-option]")
                    ?.focus();
                  return;
                }
                if (event.key === "Enter" && matchCount === 1) {
                  const onlyMatch = options.find((option) => manualOptionMatches(option, searchValue));
                  if (onlyMatch) {
                    event.preventDefault();
                    selectOption(onlyMatch.value);
                  }
                }
              }}
            />
            <span aria-live="polite">{matchCount}</span>
          </div>

          <div
            id={`${fieldId}-listbox`}
            className={styles.configPickerList}
            role="listbox"
            aria-labelledby={`${fieldId}-label`}
          >
            <button
              type="button"
              role="option"
              aria-selected={value === ""}
              data-manual-option
              className={styles.configPickerOption}
              onClick={() => selectOption("")}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  closePicker(true);
                } else if (event.key === "ArrowDown") {
                  event.preventDefault();
                  focusOption(event.currentTarget, 1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  focusOption(event.currentTarget, -1);
                }
              }}
            >
              <span>{emptyLabel}</span>
              {value === "" && <Check size={14} aria-hidden="true" />}
            </button>

            {visibleOptions.length ? (
              visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  data-manual-option
                  className={`${styles.configPickerOption} ${option.value === value ? styles.configPickerOptionSelected : ""}`}
                  onClick={() => selectOption(option.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      closePicker(true);
                    } else if (event.key === "ArrowDown") {
                      event.preventDefault();
                      focusOption(event.currentTarget, 1);
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      focusOption(event.currentTarget, -1);
                    }
                  }}
                >
                  <span>{option.label}</span>
                  {option.value === value && <Check size={14} aria-hidden="true" />}
                </button>
              ))
            ) : (
              <div className={styles.configPickerEmpty} role="status">
                No encontramos coincidencias. Prueba con otro término.
              </div>
            )}
          </div>

          <div className={styles.configPickerFooter}>
            {searchValue.trim()
              ? `${matchCount} coincidencia${matchCount === 1 ? "" : "s"}`
              : `${options.length} opciones disponibles`}
          </div>
        </div>
      )}
    </div>
  );
}
'''
text = text[:start] + new_component + text[end:]

state_line = '  const [manualSearch, setManualSearch] = useState<ManualSearchState>(() => emptyManualSearch());\n'
assert text.count(state_line) == 1
text = text.replace(state_line, '', 1)

reset_line = '    setManualSearch(emptyManualSearch());\n'
assert text.count(reset_line) == 1
text = text.replace(reset_line, '', 1)

for old in [
  '                  searchValue={manualSearch.cpu}\n                  onSearchChange={(value) => setManualSearch((current) => ({ ...current, cpu: value }))}\n',
  '                  searchValue={manualSearch.gpu}\n                  onSearchChange={(value) => setManualSearch((current) => ({ ...current, gpu: value }))}\n',
  '                  searchValue={manualSearch.ram}\n                  onSearchChange={(value) => setManualSearch((current) => ({ ...current, ram: value }))}\n',
  '                  searchValue={manualSearch.os}\n                  onSearchChange={(value) => setManualSearch((current) => ({ ...current, os: value }))}\n',
]:
    assert text.count(old) == 1, old
    text = text.replace(old, '', 1)

client.write_text(text, encoding='utf-8')

css = Path('src/features/game-finder/GameFinderClient.module.css')
styles = css.read_text(encoding='utf-8')
start = styles.index('.configSearch {')
end = styles.index('\n.configFooter {', start)
new_css = '''.configField {
  position: relative;
}

.configFieldLabel {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 780;
}

.configPickerTrigger {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 12px;
  color: var(--text-soft);
  border: 1px solid var(--finder-line);
  border-radius: 8px;
  outline: 0;
  background: var(--surface-control);
  cursor: pointer;
  font-size: var(--font-xs);
  text-align: left;
}

.configPickerTrigger:hover,
.configPickerTriggerOpen {
  border-color: rgba(255, 8, 71, 0.36);
  background: rgba(13, 19, 29, 0.96);
}

.configPickerTrigger:focus-visible {
  border-color: rgba(255, 8, 71, 0.48);
  box-shadow: 0 0 0 3px rgba(255, 8, 71, 0.05);
}

.configPickerTrigger > svg {
  flex: 0 0 auto;
  color: var(--text-muted);
  transition: transform var(--ease-fast), color var(--ease-fast);
}

.configPickerTriggerOpen > svg {
  color: var(--brand-light);
  transform: rotate(180deg);
}

.configPickerValue,
.configPickerPlaceholder {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.configPickerPlaceholder {
  color: #7d8998;
}

.configPickerMenu {
  position: absolute;
  top: calc(100% + 7px);
  left: 0;
  z-index: 80;
  width: 100%;
  min-width: min(420px, calc(100vw - 56px));
  overflow: hidden;
  border: 1px solid rgba(255, 8, 71, 0.28);
  border-radius: 11px;
  background: rgba(7, 11, 18, 0.985);
  box-shadow: 0 22px 55px rgba(0, 0, 0, 0.55), 0 0 42px rgba(255, 8, 71, 0.06);
  backdrop-filter: blur(18px);
}

.configPickerSearch {
  position: relative;
  padding: 10px;
  border-bottom: 1px solid var(--finder-line);
  background: rgba(255, 255, 255, 0.018);
}

.configPickerSearch > svg {
  position: absolute;
  left: 21px;
  top: 50%;
  z-index: 1;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.configPickerSearch input {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 0 52px 0 34px;
  color: var(--text-soft);
  border: 1px solid var(--finder-line);
  border-radius: 8px;
  outline: 0;
  background: rgba(3, 7, 12, 0.9);
  font-size: var(--font-xs);
}

.configPickerSearch input::placeholder {
  color: #778393;
}

.configPickerSearch input:focus-visible {
  border-color: rgba(255, 8, 71, 0.5);
  box-shadow: 0 0 0 3px rgba(255, 8, 71, 0.055);
}

.configPickerSearch > span {
  position: absolute;
  right: 21px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--brand-light);
  font-size: 9px;
  font-weight: 850;
  pointer-events: none;
}

.configPickerList {
  max-height: 270px;
  overflow: auto;
  padding: 6px;
  scrollbar-gutter: stable;
}

.configPickerOption {
  width: 100%;
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px;
  color: var(--text-soft);
  border: 0;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  text-align: left;
}

.configPickerOption:hover,
.configPickerOption:focus-visible {
  color: #fff;
  outline: 0;
  background: rgba(255, 8, 71, 0.09);
}

.configPickerOptionSelected {
  color: #fff;
  background: rgba(255, 8, 71, 0.12);
}

.configPickerOption > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.configPickerOption > svg {
  flex: 0 0 auto;
  color: var(--success);
}

.configPickerEmpty {
  padding: 22px 14px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.45;
  text-align: center;
}

.configPickerFooter {
  padding: 7px 11px 8px;
  color: #7f8b9b;
  border-top: 1px solid var(--finder-line);
  background: rgba(255, 255, 255, 0.012);
  font-size: 9px;
}
'''
styles = styles[:start] + new_css + styles[end:]

anchor = '''  .gameCard::before,
  .gameCardSpotlight {
    display: none;
  }
'''
insert = '''  .gameCard::before,
  .gameCardSpotlight {
    display: none;
  }

  .configPickerTrigger > svg {
    transition: none;
  }
'''
assert styles.count(anchor) == 1
styles = styles.replace(anchor, insert, 1)
css.write_text(styles, encoding='utf-8')
