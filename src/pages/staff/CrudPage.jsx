import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { fromTimeInput, toDateInput, toTimeInput } from "../../lib/format.js";
import Icon from "../../components/Icon.jsx";
import ImageField from "../../components/ImageField.jsx";
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

const PAGE_SIZE = 10;

// Page numbers to show: first, last and the two around the current page; null = a gap ("…")
const pageNumbers = (page, count) => {
  const keep = [...new Set([1, page - 1, page, page + 1, count])]
    .filter((n) => n >= 1 && n <= count)
    .sort((a, b) => a - b);
  return keep.flatMap((n, i) => (i && n - keep[i - 1] > 1 ? [null, n] : [n]));
};

function Pager({ page, pageCount, total, onPage }) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  return (
    <nav className="pager" aria-label="Phân trang">
      <span className="muted num">
        {from}–{to} / {total}
      </span>
      <div className="pager__pages">
        <IconButton icon="chevronLeft" label="Trang trước" disabled={page === 1} onClick={() => onPage(page - 1)} />
        {pageNumbers(page, pageCount).map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} className="pager__gap" aria-hidden="true">…</span>
          ) : (
            <button
              key={n}
              type="button"
              className={`pager__num num ${n === page ? "is-active" : ""}`}
              aria-current={n === page ? "page" : undefined}
              onClick={() => onPage(n)}
            >
              {n}
            </button>
          ),
        )}
        <IconButton icon="chevronRight" label="Trang sau" disabled={page === pageCount} onClick={() => onPage(page + 1)} />
      </div>
    </nav>
  );
}

/**
 * Generic list + create/edit/delete page driven by a config object (see resources.jsx).
 *
 * config = {
 *   key, title, singular, description,          // description: string | (user) => string
 *   source: resource | (user) => resource      // { list, create, update, remove, preview? }
 *   sample?: array                              // shown when the API is offline
 *   lookups?: (user) => ({ name: { load, sample } })   // data for <select> options
 *   columns: [{ key, label, render?(row, lookups), className?, hidden?(user) }]
 *   filters?: [{ key, label, all, options(rows, lookups), match(row, value) }]   // selects beside the search
 *   fields?: [{ name, label, type, required, options?, optionsFrom?(lookups, user), createOnly?, editOnly?,
 *               numeric?, min?, max?, step?, help?, full?, defaultValue?(user) }]
 *               type "image" = a photo picked from the computer, uploaded at once; the value is its link
 *   searchText?(row), sort?(a, b), validate?(values), toRequest?(values, ctx), canWrite?(user), canDelete?(user),
 *   canEditRow?(row, user)                      // false hides that row's edit button
 *   rowActions?: [{ label, icon?, to?(row), modal?: { title(row), render(row, lookups, { close, reload }) },
 *                   run?(row), confirm?(row), done?(row), hidden?(row, user, lookups) }],
 *   nameOf(row)                                 // used in confirm/toast messages
 * }
 * Edit and delete buttons only appear when the source has update / remove.
 * The API writes the audit log itself, so pages here never post to it.
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
  // A lookup the user may not read (HTTP 403) leaves its <select> empty instead of breaking the
  // whole form; "API offline" still falls back to the sample data.
  const lookups = useApi(
    async () =>
      Object.fromEntries(
        await Promise.all(
          Object.entries(lookupDefs).map(async ([k, l]) => {
            try {
              return [k, await l.load()];
            } catch (e) {
              if (e?.offline) throw e;
              return [k, []];
            }
          }),
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
  const [filterValues, setFilterValues] = useState({});
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null); // { mode, row, values }
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false); // an image field is still sending its file
  const [confirm, setConfirm] = useState(null);
  const [detail, setDetail] = useState(null); // { action, row }

  const offline = list.usingSample;
  const canWrite =
    !!config.fields && (config.canWrite ? config.canWrite(user) : true);
  const canUpdate = canWrite && !!source.update;
  const canCreate = canWrite && !!source.create;
  const columns = config.columns.filter((c) => !c.hidden?.(user));
  const [runningId, setRunningId] = useState(null);
  const canDelete =
    canWrite &&
    !!source.remove &&
    (config.canDelete ? config.canDelete(user) : true);
  const nameOf = config.nameOf ?? ((r) => r.name ?? r.id);
  const description =
    typeof config.description === "function" ? config.description(user) : config.description;
  const filtered = Object.values(filterValues).some(Boolean);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let all = [...(list.data ?? [])];
    if (config.sort) all.sort(config.sort);
    for (const f of config.filters ?? []) {
      const value = filterValues[f.key];
      if (value) all = all.filter((r) => f.match(r, value));
    }
    if (!needle || !config.searchText) return all;
    return all.filter((r) =>
      config.searchText(r).toLowerCase().includes(needle),
    );
  }, [list.data, query, filterValues, config]);

  // The whole list is loaded once; it is shown PAGE_SIZE rows at a time
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
    setUploading(false);
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
    setUploading(false);
  };

  const setValue = (name, value) => {
    setForm((f) => {
      const newValues = { ...f.values, [name]: value };
      return { ...f, values: newValues };
    });

    const currentField = fieldsFor(form.mode).find((f) => f.name === name);
    if (currentField?.onChange) {
      currentField.onChange(value, {
        lookups: lk,
        setFormValues: (updater) =>
          setForm((f) => ({
            ...f,
            values: typeof updater === "function" ? updater(f.values) : updater,
          })),
      });
    }
  };

  const validate = (mode, values) => {
    const e = {};
    for (const f of fieldsFor(mode)) {
      const v = values[f.name];
      if (f.required && (v === "" || v === null || v === undefined))
        e[f.name] = `${f.type === "select" ? "Vui lòng chọn" : "Vui lòng nhập"} ${f.label.charAt(0).toLowerCase()}${f.label.slice(1)}.`;
      else if (f.type === "number" && v !== "") {
        const n = Number(v);
        if (Number.isNaN(n)) e[f.name] = `${f.label} phải là số.`;
        else if (f.min !== undefined && n < f.min)
          e[f.name] = `${f.label} tối thiểu là ${f.min}.`;
        else if (f.max !== undefined && n > f.max)
          e[f.name] = `${f.label} tối đa là ${f.max}.`;
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
          ? `Đã thêm ${config.singular.toLowerCase()}.`
          : `Đã lưu ${config.singular.toLowerCase()}.`,
      );
      setForm(null);
      list.reload();
    } catch (err) {
      let errorMsg = "Đã xảy ra lỗi hệ thống.";
      const responseData = err.response?.data;

      if (responseData) {
        if (responseData.errors && typeof responseData.errors === 'object') {
          const allErrors = [];
          for (const fieldKey of Object.keys(responseData.errors)) {
            allErrors.push(...responseData.errors[fieldKey]);
          }
          errorMsg = allErrors.join(' — ');
        } 
        else if (responseData.message) {
          errorMsg = responseData.message;
        } 
        else if (typeof responseData === 'string') {
          errorMsg = responseData;
        }
      } else if (err.message) {
        errorMsg = err.message;
      }

      if (typeof errorMsg === 'string' && errorMsg.includes('System.Exception:')) {
        errorMsg = errorMsg.split('\n')[0].replace('System.Exception: ', '');
      }
      setFormError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const row = confirm;
    setConfirm(null);
    try {
      await source.remove(row.id);
      toast.success(`Đã xóa ${config.singular.toLowerCase()} “${nameOf(row)}”.`);
      list.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Row action that calls the API directly (e.g. renew a membership)
  const runAction = async (action, row) => {
    const question = action.confirm?.(row);
    if (question && !window.confirm(question)) return;
    setRunningId(row.id);
    try {
      await action.run(row);
      toast.success(action.done?.(row) ?? `${action.label}: xong.`);
      list.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunningId(null);
    }
  };

  const hasActions = canUpdate || canDelete || config.rowActions?.length;

  return (
    <div className="staff-page">
      <header className="staff-page__head">
        <div>
          <h1 className="staff-page__title display">{config.title}</h1>
          {description && <p className="muted">{description}</p>}
        </div>
        {canCreate && (
          <Button icon="plus" onClick={openCreate} disabled={offline}>
            Thêm {config.singular.toLowerCase()}
          </Button>
        )}
      </header>

      {source.preview && <PreviewNotice feature={config.title} />}
      {offline && <SampleDataNotice onRetry={list.reload} />}
      <ErrorNotice error={!offline ? list.error : null} onRetry={list.reload} />

      {(config.searchText || config.filters) && (
        <div className="staff-toolbar">
          <div className="staff-toolbar__tools">
            {config.searchText && (
              <label className="staff-search">
                <Icon name="search" size={20} />
                <input
                  type="search"
                  placeholder={`Tìm ${config.title.toLowerCase()}`}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  aria-label={`Tìm ${config.title.toLowerCase()}`}
                />
              </label>
            )}
            {config.filters?.map((f) => (
              <div key={f.key} className="select-wrap staff-filter">
                <select
                  className="input"
                  aria-label={f.label}
                  value={filterValues[f.key] ?? ""}
                  onChange={(e) => {
                    setFilterValues((s) => ({ ...s, [f.key]: e.target.value }));
                    setPage(1);
                  }}
                >
                  <option value="">{f.all}</option>
                  {f.options(list.data ?? [], lk).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Icon name="chevronDown" size={18} className="select-wrap__icon" />
              </div>
            ))}
          </div>
          <span className="muted num">
            {rows.length} kết quả
          </span>
        </div>
      )}

      {list.loading ? (
        <Loading />
      ) : rows.length ? (
        <>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} scope="col">
                    {c.label}
                  </th>
                ))}
                {hasActions && (
                  <th scope="col">
                    <span className="visually-hidden">Thao tác</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id ?? JSON.stringify(row)}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.className}>
                      {c.render ? c.render(row, lk) : row[c.key]}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="cell-actions">
                      {config.rowActions?.map((a) => {
                        if (a.hidden?.(row, user, lk)) return null;

                        if (a.run) {
                          return (
                            <Button
                              key={a.label}
                              variant="secondary"
                              size="sm"
                              onClick={() => runAction(a, row)}
                              disabled={offline || runningId === row.id}
                            >
                              {a.label}
                            </Button>
                          );
                        }
                        return a.to ? (
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
                        );
                      })}
                      {canUpdate && (config.canEditRow?.(row, user) ?? true) && (
                        <IconButton
                          icon="edit"
                          label={`Sửa ${nameOf(row)}`}
                          onClick={() => openEdit(row)}
                          disabled={offline}
                        />
                      )}
                      {canDelete && (
                        <IconButton
                          icon="trash"
                          label={`Xóa ${nameOf(row)}`}
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
        <Pager page={currentPage} pageCount={pageCount} total={rows.length} onPage={setPage} />
        </>
      ) : (
        !list.error && (
          <EmptyState
            title={
              query || filtered
                ? "Không có kết quả phù hợp"
                : `Chưa có ${config.title.toLowerCase()} nào`
            }
            action={
              !query &&
              !filtered &&
              canCreate && (
                <Button icon="plus" onClick={openCreate}>
                  Thêm {config.singular.toLowerCase()}
                </Button>
              )
            }
          >
            {query || filtered
              ? "Kiểm tra lại từ khóa, hoặc xóa ô tìm kiếm và bộ lọc."
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
            ? `Thêm ${config.singular.toLowerCase()}`
            : `Sửa ${config.singular.toLowerCase()}`
        }
        onClose={() => setForm(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              Hủy
            </Button>
            <Button type="submit" form="crud-form" disabled={saving || uploading}>
              {saving
                ? "Đang lưu…"
                : uploading
                  ? "Chờ ảnh tải lên…"
                  : form?.mode === "create"
                  ? `Thêm ${config.singular.toLowerCase()}`
                  : "Lưu thay đổi"}
            </Button>
          </>
        }
      >
        {form && (
          <form id="crud-form" onSubmit={save} noValidate>
            {formError && (
              <div className="form-error">
                <Notice tone="danger" title="Không lưu được">
                  {formError}
                </Notice>
              </div>
            )}
            <div className="form-grid">
              {fieldsFor(form.mode).map((f) => f.type === "image" ? (
                <ImageField
                  key={f.name}
                  className="field--full"
                  label={f.label}
                  name={f.name}
                  help={f.help}
                  value={form.values[f.name]}
                  onChange={setValue}
                  onBusy={setUploading}
                  error={errors[f.name]}
                />
              ) : (
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
        title={`Xóa ${config.singular.toLowerCase()}?`}
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Giữ lại
            </Button>
            <Button variant="danger" onClick={remove}>
              Xóa
            </Button>
          </>
        }
      >
        {confirm && (
          <p>
            “{nameOf(confirm)}” sẽ bị xóa vĩnh viễn. Nếu dữ liệu khác vẫn đang dùng
            mục này, máy chủ sẽ từ chối và cho biết lý do.
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
        {detail && detail.action.modal.render(detail.row, lk, { close: () => setDetail(null), reload: list.reload })}
      </Modal>
    </div>
  );
}
