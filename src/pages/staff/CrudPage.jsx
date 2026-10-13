import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { fromTimeInput, toDateInput, toTimeInput } from "../../lib/format.js";
import Icon from "../../components/Icon.jsx";
import Modal from "../../components/Modal.jsx";
import { useToast } from "../../components/Toast.jsx";
import {
  Button,
  EmptyState,
  ErrorNotice,
  Field,
  IconButton,
  Loading,
  Notice,
  PreviewNotice,
  SampleDataNotice,
} from "../../components/ui.jsx";

/**
 * Generic list + create/edit/delete page driven by a config object (see resources.jsx).
 *
 * config = {
 *   key, title, singular, description,
 *   source: resource | (user) => resource      // { list, create, update, remove, preview? }
 *   sample?: array                              // shown when the API is offline
 *   lookups?: (user) => ({ name: { load, sample } })   // data for <select> options
 *   columns: [{ key, label, render?(row, lookups), className? }]
 *   fields?: [{ name, label, type, required, options?, optionsFrom?(lookups, user), createOnly?, editOnly?,
 *               numeric?, min?, max?, step?, help?, full?, defaultValue?(user) }]
 *   searchText?(row), sort?(a, b), validate?(values), toRequest?(values, ctx), canWrite?(user), canDelete?(user),
 *   rowActions?: [{ label, icon?, to?(row), modal?: { title(row), render(row, lookups) } }],
 *   nameOf(row)                                 // used in confirm/toast messages
 * }
 */
export default function CrudPage({ config }) {
  const { user } = useAuth();
  const toast = useToast();
  const source =
    typeof config.source === "function" ? config.source(user) : config.source;
  const lookupDefs = config.lookups ? config.lookups(user) : {};

  const list = useApi(() => source.list(), [config.key, user?.accountId], {
    sample: config.sample,
  });
  const lookups = useApi(
    async () =>
      Object.fromEntries(
        await Promise.all(
          Object.entries(lookupDefs).map(async ([k, l]) => [k, await l.load()]),
        ),
      ),
    [config.key, user?.accountId],
    {
      sample: () =>
        Object.fromEntries(
          Object.entries(lookupDefs).map(([k, l]) => [k, l.sample ?? []]),
        ),
    },
  );
  const lk = lookups.data ?? {};

  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null); // { mode, row, values }
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [detail, setDetail] = useState(null); // { action, row }

  const offline = list.usingSample;
  const canWrite =
    !!config.fields && (config.canWrite ? config.canWrite(user) : true);
  const canDelete =
    canWrite &&
    !!source.remove &&
    (config.canDelete ? config.canDelete(user) : true);
  const nameOf = config.nameOf ?? ((r) => r.name ?? r.id);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = [...(list.data ?? [])];
    if (config.sort) all.sort(config.sort);
    if (!needle || !config.searchText) return all;
    return all.filter((r) =>
      config.searchText(r).toLowerCase().includes(needle),
    );
  }, [list.data, query, config]);

  const fieldsFor = (mode) =>
    (config.fields ?? []).filter((f) =>
      mode === "create" ? !f.editOnly : !f.createOnly,
    );

  const openCreate = () => {
    const values = Object.fromEntries(
      fieldsFor("create").map((f) => [
        f.name,
        f.defaultValue ? f.defaultValue(user) : "",
      ]),
    );
    setForm({ mode: "create", row: null, values });
    setErrors({});
    setFormError(null);
  };
  const openEdit = (row) => {
    const values = Object.fromEntries(
      fieldsFor("edit").map((f) => {
        const v = row[f.name];
        if (f.type === "date") return [f.name, toDateInput(v)];
        if (f.type === "time") return [f.name, toTimeInput(v)];
        return [f.name, v === null || v === undefined ? "" : String(v)];
      }),
    );
    setForm({ mode: "edit", row, values });
    setErrors({});
    setFormError(null);
  };

  const setValue = (name, value) =>
    setForm((f) => ({ ...f, values: { ...f.values, [name]: value } }));

  const validate = (mode, values) => {
    const e = {};
    for (const f of fieldsFor(mode)) {
      const v = values[f.name];
      if (f.required && (v === "" || v === null || v === undefined))
        e[f.name] = `${f.label} is required.`;
      else if (f.type === "number" && v !== "") {
        const n = Number(v);
        if (Number.isNaN(n)) e[f.name] = `${f.label} must be a number.`;
        else if (f.min !== undefined && n < f.min)
          e[f.name] = `${f.label} must be at least ${f.min}.`;
        else if (f.max !== undefined && n > f.max)
          e[f.name] = `${f.label} must be at most ${f.max}.`;
      }
    }
    return { ...e, ...(config.validate ? config.validate(values, mode) : {}) };
  };

  const toRequest = (mode, values) => {
    const body = {};
    for (const f of fieldsFor(mode)) {
      const v = values[f.name];
      if (v === "" || v === undefined) continue; // let the API use its default
      if (f.type === "number" || f.numeric) body[f.name] = Number(v);
      else if (f.type === "time") body[f.name] = fromTimeInput(v);
      else body[f.name] = v;
    }
    return config.toRequest
      ? config.toRequest(body, { mode, lookups: lk, user, row: form?.row })
      : body;
  };

  const save = async (e) => {
    e.preventDefault();
    const found = validate(form.mode, form.values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setFormError(null);
    try {
      const body = toRequest(form.mode, form.values);
      if (form.mode === "create") await source.create(body);
      else await source.update(form.row.id, body);
      toast.success(
        form.mode === "create"
          ? `${config.singular} added.`
          : `${config.singular} saved.`,
      );
      setForm(null);
      list.reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const row = confirm;
    setConfirm(null);
    try {
      await source.remove(row.id);
      toast.success(`${config.singular} “${nameOf(row)}” deleted.`);
      list.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const hasActions = canWrite || canDelete || config.rowActions?.length;

  return (
    <div className="staff-page">
      <header className="staff-page__head">
        <div>
          <h1 className="staff-page__title display">{config.title}</h1>
          {config.description && <p className="muted">{config.description}</p>}
        </div>
        {canWrite && (
          <Button icon="plus" onClick={openCreate} disabled={offline}>
            Add {config.singular.toLowerCase()}
          </Button>
        )}
      </header>

      {source.preview && <PreviewNotice feature={config.title} />}
      {offline && <SampleDataNotice onRetry={list.reload} />}
      <ErrorNotice error={!offline ? list.error : null} onRetry={list.reload} />

      {config.searchText && (
        <div className="staff-toolbar">
          <label className="staff-search">
            <Icon name="search" size={20} />
            <input
              type="search"
              placeholder={`Search ${config.title.toLowerCase()}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={`Search ${config.title.toLowerCase()}`}
            />
          </label>
          <span className="muted num">
            {rows.length} {rows.length === 1 ? "result" : "results"}
          </span>
        </div>
      )}

      {list.loading ? (
        <Loading />
      ) : rows.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {config.columns.map((c) => (
                  <th key={c.key} scope="col">
                    {c.label}
                  </th>
                ))}
                {hasActions && (
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id ?? JSON.stringify(row)}>
                  {config.columns.map((c) => (
                    <td key={c.key} className={c.className}>
                      {c.render ? c.render(row, lk) : row[c.key]}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="cell-actions">
                      {config.rowActions?.map((a) =>
                        a.to ? (
                          <Link
                            key={a.label}
                            className="btn btn--secondary btn--sm"
                            to={a.to(row)}
                          >
                            {a.label}
                          </Link>
                        ) : (
                          <Button
                            key={a.label}
                            variant="secondary"
                            size="sm"
                            onClick={() => setDetail({ action: a, row })}
                          >
                            {a.label}
                          </Button>
                        ),
                      )}
                      {canWrite && (
                        <IconButton
                          icon="edit"
                          label={`Edit ${nameOf(row)}`}
                          onClick={() => openEdit(row)}
                          disabled={offline}
                        />
                      )}
                      {canDelete && (
                        <IconButton
                          icon="trash"
                          label={`Delete ${nameOf(row)}`}
                          onClick={() => setConfirm(row)}
                          disabled={offline}
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !list.error && (
          <EmptyState
            title={
              query
                ? "Nothing matches that search"
                : `No ${config.title.toLowerCase()} yet`
            }
            action={
              !query &&
              canWrite && (
                <Button icon="plus" onClick={openCreate}>
                  Add {config.singular.toLowerCase()}
                </Button>
              )
            }
          >
            {query
              ? "Check the spelling or clear the search."
              : config.emptyHint}
          </EmptyState>
        )
      )}

      {/* Create / edit */}
      <Modal
        open={!!form}
        wide={(config.fields?.length ?? 0) > 4}
        title={
          form?.mode === "create"
            ? `Add ${config.singular.toLowerCase()}`
            : `Edit ${config.singular.toLowerCase()}`
        }
        onClose={() => setForm(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button type="submit" form="crud-form" disabled={saving}>
              {saving
                ? "Saving…"
                : form?.mode === "create"
                  ? `Add ${config.singular.toLowerCase()}`
                  : "Save changes"}
            </Button>
          </>
        }
      >
        {form && (
          <form id="crud-form" onSubmit={save} noValidate>
            {formError && (
              <div className="form-error">
                <Notice tone="danger" title="Couldn’t save">
                  {formError}
                </Notice>
              </div>
            )}
            <div className="form-grid">
              {fieldsFor(form.mode).map((f) => (
                <Field
                  key={f.name}
                  className={
                    f.full || f.type === "textarea" ? "field--full" : ""
                  }
                  label={f.label}
                  name={f.name}
                  type={f.type ?? "text"}
                  required={f.required}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  help={f.help}
                  placeholder={f.placeholder}
                  options={f.optionsFrom ? f.optionsFrom(lk, user) : f.options}
                  value={form.values[f.name]}
                  onChange={setValue}
                  error={errors[f.name]}
                />
              ))}
            </div>
          </form>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!confirm}
        title={`Delete ${config.singular.toLowerCase()}?`}
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          </>
        }
      >
        {confirm && (
          <p>
            “{nameOf(confirm)}” will be removed permanently. If other records
            still use it, the server will refuse and tell you why.
          </p>
        )}
      </Modal>

      {/* Row detail (e.g. class roster) */}
      <Modal
        open={!!detail}
        wide
        title={detail ? detail.action.modal.title(detail.row) : ""}
        onClose={() => setDetail(null)}
      >
        {detail && detail.action.modal.render(detail.row, lk)}
      </Modal>
    </div>
  );
}
