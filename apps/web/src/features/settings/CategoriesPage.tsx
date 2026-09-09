import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError, createApiClient } from '@club-basket/api-client'
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@club-basket/contracts'

const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://localhost:3000')

const emptyForm: CreateCategoryInput = {
  name: '', ageMin: null, ageMax: null, birthYearFrom: null, birthYearTo: null, birthYearLabel: null, sortOrder: 100,
}

function numberOrNull(value: string): number | null {
  return value.trim() === '' ? null : Number(value)
}

function categoryToUpdate(category: Category): UpdateCategoryInput {
  return {
    name: category.name,
    ageMin: category.ageMin,
    ageMax: category.ageMax,
    birthYearFrom: category.birthYearFrom,
    birthYearTo: category.birthYearTo,
    birthYearLabel: category.birthYearLabel,
    sortOrder: category.sortOrder,
    status: category.status,
  }
}

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CreateCategoryInput>(emptyForm)
  const [editing, setEditing] = useState<Category | null>(null)
  const [error, setError] = useState<string | null>(null)
  const categoriesQuery = useQuery({ queryKey: ['settings', 'categories'], queryFn: () => api.listSettingsCategories() })
  const createMutation = useMutation({
    mutationFn: (input: CreateCategoryInput) => api.createCategory(input),
    onSuccess: () => { setForm(emptyForm); setError(null); void queryClient.invalidateQueries({ queryKey: ['settings', 'categories'] }) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) => api.updateCategory(id, input),
    onSuccess: () => { setEditing(null); setError(null); void queryClient.invalidateQueries({ queryKey: ['settings', 'categories'] }) },
  })

  function handleError(cause: unknown) {
    setError(cause instanceof ApiClientError ? cause.message : 'No se pudo guardar la categoría')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    createMutation.mutate({ ...form, birthYearLabel: form.birthYearLabel || null }, { onError: handleError })
  }

  function saveEditing() {
    if (!editing) return
    updateMutation.mutate({ id: editing.id, input: categoryToUpdate(editing) }, { onError: handleError })
  }

  return (
    <section className="page-content">
      <p className="eyebrow">Configuración del club</p>
      <h1>Categorías</h1>
      <p className="page-intro">Define las categorías disponibles para organizar los equipos por edad y temporada.</p>

      <form className="settings-form category-form" onSubmit={submit}>
        <h2>Nueva categoría</h2>
        <label>Nombre<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <div className="form-grid-2">
          <label>Edad mínima<input type="number" min="0" value={form.ageMin ?? ''} onChange={(event) => setForm({ ...form, ageMin: numberOrNull(event.target.value) })} /></label>
          <label>Edad máxima<input type="number" min="0" value={form.ageMax ?? ''} onChange={(event) => setForm({ ...form, ageMax: numberOrNull(event.target.value) })} /></label>
          <label>Año desde<input type="number" min="1900" value={form.birthYearFrom ?? ''} onChange={(event) => setForm({ ...form, birthYearFrom: numberOrNull(event.target.value) })} /></label>
          <label>Año hasta<input type="number" min="1900" value={form.birthYearTo ?? ''} onChange={(event) => setForm({ ...form, birthYearTo: numberOrNull(event.target.value) })} /></label>
        </div>
        <label>Texto de años<input placeholder="Ej. 2011-2012" value={form.birthYearLabel ?? ''} onChange={(event) => setForm({ ...form, birthYearLabel: event.target.value })} /></label>
        <label>Orden<input type="number" min="0" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Guardando…' : 'Añadir categoría'}</button>
      </form>

      {categoriesQuery.isLoading && <p className="status-message">Cargando categorías…</p>}
      {categoriesQuery.isError && <p className="status-message error">No se han podido cargar las categorías.</p>}
      <div className="category-list">
        {categoriesQuery.data?.items.map((category) => (
          <article className={`category-card ${category.status}`} key={category.id}>
            <div className="category-card-heading"><div><h2>{category.name}</h2><p>{category.birthYearLabel ?? 'Sin año indicado'}{category.ageMin !== null ? ` · ${category.ageMin}-${category.ageMax ?? '…'} años` : ''}</p></div><span className="user-status">{category.status === 'active' ? 'Activa' : 'Inactiva'}</span></div>
            <div className="category-actions">
              <button className="secondary-button" type="button" onClick={() => { setEditing(category); setError(null) }}>Editar</button>
              <button className="secondary-button" type="button" onClick={() => updateMutation.mutate({ id: category.id, input: { status: category.status === 'active' ? 'inactive' : 'active' } }, { onError: handleError })}>{category.status === 'active' ? 'Desactivar' : 'Activar'}</button>
            </div>
            {editing?.id === category.id && (
              <div className="inline-editor">
                <label>Nombre<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
                <div className="form-grid-2">
                  <label>Edad mín.<input type="number" min="0" value={editing.ageMin ?? ''} onChange={(event) => setEditing({ ...editing, ageMin: numberOrNull(event.target.value) })} /></label>
                  <label>Edad máx.<input type="number" min="0" value={editing.ageMax ?? ''} onChange={(event) => setEditing({ ...editing, ageMax: numberOrNull(event.target.value) })} /></label>
                  <label>Año desde<input type="number" min="1900" value={editing.birthYearFrom ?? ''} onChange={(event) => setEditing({ ...editing, birthYearFrom: numberOrNull(event.target.value) })} /></label>
                  <label>Año hasta<input type="number" min="1900" value={editing.birthYearTo ?? ''} onChange={(event) => setEditing({ ...editing, birthYearTo: numberOrNull(event.target.value) })} /></label>
                </div>
                <label>Texto de años<input value={editing.birthYearLabel ?? ''} onChange={(event) => setEditing({ ...editing, birthYearLabel: event.target.value })} /></label>
                <label>Orden<input type="number" min="0" value={editing.sortOrder} onChange={(event) => setEditing({ ...editing, sortOrder: Number(event.target.value) })} /></label>
                <label>Estado<select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as Category['status'] })}><option value="active">Activa</option><option value="inactive">Inactiva</option></select></label>
                <div className="category-actions"><button className="primary-button" type="button" onClick={saveEditing} disabled={updateMutation.isPending}>Guardar cambios</button><button className="secondary-button" type="button" onClick={() => setEditing(null)}>Cancelar</button></div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
