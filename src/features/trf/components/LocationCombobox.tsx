import { useState, useEffect, useRef } from "react";
import { useTRFStore } from "@/store";

interface Props {
  transport: string;
  value?: string; // ✅ Ubah jadi string sesuai kebutuhan TRF
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function LocationCombobox({
  transport,
  value = "",
  onChange,
  placeholder = "Search location...",
  disabled = false
}: Props) {
  const { searchLocations } = useTRFStore();

  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const transportMap: any = {
    FLIGHT: "AIRPORT",
    TRAIN: "TRAIN_STATION",
    SHIP: "SEAPORT",
    CAR: "CITY",
    SELF_ARRANGEMENT: "CITY"
  };

  // ✅ Sinkronisasi jika value dari props berubah (misal saat Edit TRF)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // ✅ UX: Tutup dropdown kalau klik di luar area combobox
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async (text: string) => {
    setQuery(text);
    
    // Jika user menghapus teks sampai kosong, kosongkan juga state di parent
    if (text === "") {
      onChange("");
      setResults([]);
      setOpen(false);
      return;
    }

    if (text.length < 2) {
      setResults([]);
      return;
    }

    const type = transportMap[transport];
    const data = await searchLocations(text, type);

    setResults(data);
    setOpen(true);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        disabled={disabled}
        value={query} // ✅ Cukup gunakan query
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => {
            if (results.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
      />

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full bg-white border rounded-md shadow-lg mt-1 max-h-60 overflow-auto">
          {results.map((loc) => (
            <div
              key={loc.id}
              className="p-3 hover:bg-gray-50 cursor-pointer flex flex-col"
              onClick={() => {
                onChange(loc.name); // ✅ Kirim loc.name (string) ke parent
                setQuery(loc.name); // Update teks di input
                setOpen(false); // Tutup dropdown
              }}
            >
              <span className="font-medium text-sm text-gray-900">{loc.name}</span>
              <span className="text-xs text-gray-400 mt-0.5">
                {loc.type.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}