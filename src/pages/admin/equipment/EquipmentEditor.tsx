// Equipment editor — create or edit an equipment item. Every field except
// name + category is optional (purchase info is often unavailable). The
// asset number is generated server-side per category (GML-GNSS-001 …) or
// entered manually; on edit it is immutable.
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Loader2, Plus, X } from "lucide-react"
import {
  fetchEquipmentCategories, fetchEquipmentDetail, createEquipmentItem,
  updateEquipmentItem,
} from "@/lib/equipmentApi"
import {
  EQUIPMENT_CONDITIONS, MAINTENANCE_FREQUENCIES,
} from "@/types/equipment"
import type { EquipmentCondition } from "@/types/equipment"
import type { EquipmentCategory, EquipmentPhoto } from "@/types/equipment"
import { CrmSpinner, CrmErrorState } from "@/components/admin/crm/CrmUI"
import {
  Field, inputClass, selectClass, primaryButtonClass, outlineButtonClass, formatMoney,
} from "@/components/admin/equipment/EquipmentUI"

export default function EquipmentEditor() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const editing = Boolean(id)

  const [categories, setCategories] = useState<EquipmentCategory[]>([])
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [categoryId, setCategoryId] = useState("")
  const [assetNumber, setAssetNumber] = useState("")
  const [name, setName] = useState("")
  const [manufacturer, setManufacturer] = useState("")
  const [model, setModel] = useState("")
  const [serialNumber, setSerialNumber] = useState("")
  const [description, setDescription] = useState("")
  const [purchaseDate, setPurchaseDate] = useState("")
  const [purchasePrice, setPurchasePrice] = useState("")
  const [currentValue, setCurrentValue] = useState("")
  const [condition, setCondition] = useState<EquipmentCondition>("Good")
  const [location, setLocation] = useState("")
  const [warrantyExpiry, setWarrantyExpiry] = useState("")
  const [notes, setNotes] = useState("")
  const [maintFrequency, setMaintFrequency] = useState("None")
  const [maintCustomDays, setMaintCustomDays] = useState("90")
  const [maintNext, setMaintNext] = useState("")
  const [calMonths, setCalMonths] = useState("12")
  const [calNext, setCalNext] = useState("")
  const [photos, setPhotos] = useState<EquipmentPhoto[]>([])
  const [photoUrl, setPhotoUrl] = useState("")
  const [photoLabel, setPhotoLabel] = useState("")

  useEffect(() => {
    fetchEquipmentCategories().then((r) => setCategories(r.categories)).catch((e) => setError(e instanceof Error ? e.message : "Could not load categories"))
  }, [])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const detail = await fetchEquipmentDetail(id)
      const item = detail.equipment
      setCategoryId(item.category.id)
      setAssetNumber(item.assetNumber)
      setName(item.name)
      setManufacturer(item.manufacturer)
      setModel(item.model)
      setSerialNumber(item.serialNumber)
      setDescription(item.description)
      setPurchaseDate(item.purchase.date)
      setPurchasePrice(item.purchase.priceMinor ? String(item.purchase.priceMinor / 100) : "")
      setCurrentValue(item.currentValueMinor ? String(item.currentValueMinor / 100) : "")
      setCondition(item.condition)
      setLocation(item.location)
      setWarrantyExpiry(item.warrantyExpiry)
      setNotes(item.notes)
      setMaintFrequency(item.maintenanceSchedule.frequency)
      setMaintCustomDays(String(item.maintenanceSchedule.customDays || 90))
      setMaintNext(item.maintenanceSchedule.nextDate)
      setCalMonths(String(item.calibrationSchedule.frequencyMonths))
      setCalNext(item.calibrationSchedule.nextDate)
      setPhotos(item.photos)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load equipment")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const addPhoto = () => {
    if (!photoUrl.trim()) return
    setPhotos([...photos, { url: photoUrl.trim(), label: photoLabel.trim(), uploadedAt: new Date().toISOString() }])
    setPhotoUrl(""); setPhotoLabel("")
  }

  const submit = async () => {
    if (!name.trim()) { setError("Equipment name is required"); return }
    if (!categoryId) { setError("Pick a category"); return }
    setSaving(true); setError("")
    const payload = {
      name: name.trim(),
      manufacturer: manufacturer || undefined,
      model: model || undefined,
      serialNumber: serialNumber || undefined,
      description: description || undefined,
      purchase: purchaseDate || purchasePrice
        ? { date: purchaseDate, priceMinor: purchasePrice ? Math.round(Number(purchasePrice) * 100) : 0 }
        : undefined,
      currentValueMinor: currentValue ? Math.round(Number(currentValue) * 100) : 0,
      condition,
      location: location || undefined,
      warrantyExpiry: warrantyExpiry || undefined,
      notes: notes || undefined,
      maintenanceSchedule: {
        frequency: maintFrequency,
        customDays: maintFrequency === "Custom" ? Number(maintCustomDays) || 90 : null,
        nextDate: maintNext || "",
      },
      calibrationSchedule: { frequencyMonths: Number(calMonths) || 0, nextDate: calNext || "" },
      photos,
    }
    try {
      if (editing && id) {
        await updateEquipmentItem(id, payload)
        navigate(`/admin/equipment/${id}`)
      } else {
        const result = await createEquipmentItem({ ...payload, categoryId, assetNumber: assetNumber || undefined })
        navigate(`/admin/equipment/${result.equipment.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the equipment")
      setSaving(false)
    }
  }

  if (loading) return <CrmSpinner />

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-brand-dark">{editing ? "Edit Equipment" : "Register Equipment"}</h1>
        <p className="text-sm text-muted-foreground">
          {editing ? `Asset number ${assetNumber} is permanent.` : "Only the name and category are required — the asset number is generated automatically if left empty."}
        </p>
      </div>

      {error && <CrmErrorState message={error} />}

      <div className="space-y-4 rounded-lg border bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Equipment name *">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="GNSS Receiver" />
          </Field>
          <Field label="Category *">
            <select className={selectClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={editing}>
              <option value="">— pick a category —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </Field>
          {!editing && (
            <Field label="Asset number (optional — auto-generated when empty)" hint={`Format GML-<category code>-NNN, e.g. GML-${categories.find((c) => c.id === categoryId)?.code || "GNSS"}-001`}>
              <input className={inputClass} value={assetNumber} onChange={(e) => setAssetNumber(e.target.value.toUpperCase())} placeholder="leave empty to auto-generate" />
            </Field>
          )}
          {editing && (
            <Field label="Asset number (immutable)">
              <input className={inputClass} value={assetNumber} disabled />
            </Field>
          )}
          <Field label="Manufacturer">
            <input className={inputClass} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Trimble" />
          </Field>
          <Field label="Model">
            <input className={inputClass} value={model} onChange={(e) => setModel(e.target.value)} />
          </Field>
          <Field label="Manufacturer serial number" hint="Separate from the internal asset number">
            <input className={inputClass} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
          </Field>
          <Field label="Current location">
            <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ibadan Office" />
          </Field>
          <Field label="Condition">
            <select className={selectClass} value={condition} onChange={(e) => setCondition(e.target.value as EquipmentCondition)}>
              {EQUIPMENT_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Warranty expiry">
            <input type="date" className={inputClass} value={warrantyExpiry} onChange={(e) => setWarrantyExpiry(e.target.value)} />
          </Field>
        </div>

        <Field label="Description / notes about the item">
          <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>

      <div className="space-y-4 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-dark">Purchase & value (all optional)</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Purchase date">
            <input type="date" className={inputClass} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </Field>
          <Field label="Purchase price (₦)">
            <input inputMode="decimal" className={inputClass} value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder={formatMoney(4500000, { symbol: "₦", minorUnits: 2 })} />
          </Field>
          <Field label="Current value (₦)">
            <input inputMode="decimal" className={inputClass} value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-dark">Schedules (optional)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Maintenance frequency" hint="Leave as “None” for as-needed maintenance">
            <select className={selectClass} value={maintFrequency} onChange={(e) => setMaintFrequency(e.target.value)}>
              {MAINTENANCE_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          {maintFrequency === "Custom" && (
            <Field label="Custom interval (days)">
              <input inputMode="numeric" className={inputClass} value={maintCustomDays} onChange={(e) => setMaintCustomDays(e.target.value)} />
            </Field>
          )}
          <Field label="Next maintenance date (optional)">
            <input type="date" className={inputClass} value={maintNext} onChange={(e) => setMaintNext(e.target.value)} />
          </Field>
          <Field label="Calibration interval (months)">
            <input inputMode="numeric" className={inputClass} value={calMonths} onChange={(e) => setCalMonths(e.target.value)} />
          </Field>
          <Field label="Next calibration date (optional)">
            <input type="date" className={inputClass} value={calNext} onChange={(e) => setCalNext(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-dark">Photos (optional)</h2>
        <p className="text-[11px] text-muted-foreground">Upload files through the Media library and paste their URLs here — the CMS media store is reused, there is no second upload path.</p>
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((p, i) => (
              <div key={`${p.url}-${i}`} className="relative rounded-md border p-2">
                <img src={p.url} alt={p.label || "equipment"} className="h-20 w-full rounded object-cover" />
                <p className="truncate text-[11px] text-muted-foreground">{p.label || p.url.split("/").pop()}</p>
                <button type="button" aria-label="Remove photo" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded bg-white/90 p-1 text-muted-foreground hover:text-red-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <Field label="Photo URL">
              <input className={inputClass} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="/media/… or https://…" />
            </Field>
          </div>
          <div className="w-36">
            <Field label="Label">
              <input className={inputClass} value={photoLabel} onChange={(e) => setPhotoLabel(e.target.value)} placeholder="Serial number" />
            </Field>
          </div>
          <button type="button" className={outlineButtonClass()} onClick={addPhoto}>
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      <Field label="Internal notes">
        <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="flex justify-end gap-2 pb-6">
        <button type="button" className={outlineButtonClass()} onClick={() => navigate(-1)}>Cancel</button>
        <button type="button" className={primaryButtonClass()} onClick={submit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {editing ? "Save changes" : "Register equipment"}
        </button>
      </div>
    </div>
  )
}
