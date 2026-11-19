import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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

export default function CrudPage({ config }) {
  const { user } = useAuth();
  const { search } = useLocation();
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
  const [filterValues, setFilterValues] = useState(() => config.initialFilters?.(search) ?? {});
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const saveFlight = useRef(false);
  const deleteFlight = useRef(false);
  const actionFlight = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (config.initialFilters) {
      setFilterValues(config.initialFilters(search));
      setPage(1);
    }
  }, [config.key, search]);

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

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const fieldsFor = (mode) =>
    (config.fields ?? []).filter((f) =>
      mode === "create" ? !f.editOnly : !f.createOnly,
    );

  const shownFields = (mode, values) =>
    fieldsFor(mode).filter((f) => !f.shown || f.shown(values, mode));

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

  const fieldOption = (field, key, values, mode) => typeof field[key] === "function"
    ? field[key](values, { mode, row: form?.row, lookups: lk, user })
    : field[key];

  const validate = (mode, values) => {
    const e = {};
    for (const f of shownFields(mode, values)) {
      const v = values[f.name];
      if (f.required && (v === "" || v === null || v === undefined))
        e[f.name] = `${f.type === "select" ? "Vui lòng chọn" : "Vui lòng nhập"} ${f.label.charAt(0).toLowerCase()}${f.label.slice(1)}.`;
      else if (f.type === "number" && v !== "") {
        const n = Number(v);
        const min = fieldOption(f, "min", values, mode);
        const max = fieldOption(f, "max", values, mode);
        if (!Number.isFinite(n)) e[f.name] = `${f.label} phải là số hợp lệ.`;
        else if (min !== undefined && n < min)
          e[f.name] = `${f.label} tối thiểu là ${min}.`;
        else if (max !== undefined && n > max)
          e[f.name] = `${f.label} tối đa là ${max}.`;
      }
    }
    const context = {
      row: form?.row, lookups: lk, user, rows: list.data,
      rowsReady: Array.isArray(list.data) && !list.loading && !list.error && !list.usingSample,
      lookupsReady: !lookups.loading && !lookups.error && !lookups.usingSample,
    };
    return { ...e, ...(config.validate ? config.validate(values, mode, context) : {}) };
  };

  const toRequest = (mode, values) => {
    const body = {};
    for (const f of shownFields(mode, values)) {
      const v = values[f.name];
      if (v === "" || v === undefined) continue;
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
    if (!form || saveFlight.current || uploading) return;
    const found = validate(form.mode, form.values);
    setErrors(found);
    if (Object.keys(found).length) return;
    saveFlight.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const body = toRequest(form.mode, form.values);
      const result = form.mode === "create"
        ? await source.create(body)
        : await source.update(form.row.id, body);
      toast.success(
        config.doneMessage?.(form.mode, result) ??
          (form.mode === "create"
            ? `Đã thêm ${config.singular.toLowerCase()}.`
            : `Đã lưu ${config.singular.toLowerCase()}.`),
      );
      setForm(null);
      list.reload();
    } catch (err) {
      if (err.partial) list.reload();
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
      saveFlight.current = false;
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm || deleteFlight.current) return;
    const row = confirm;
    const locked = config.deleteLocked?.(row, user);
    if (locked) return toast.error(locked);
    deleteFlight.current = true;
    setDeleting(true);
    try {
      await source.remove(row.id);
      toast.success(`Đã xóa ${config.singular.toLowerCase()} “${nameOf(row)}”.`);
      setConfirm(null);
      list.reload();
    } catch (err) {
      toast.error(err.message);
      list.reload();
    } finally {
      deleteFlight.current = false;
      setDeleting(false);
    }
  };

  const runAction = async (action, row) => {
    if (actionFlight.current) return;
    const question = action.confirm?.(row);
    if (question && !window.confirm(question)) return;
    actionFlight.current = true;
    setRunningId(row.id);
    try {
      await action.run(row);
      toast.success(action.done?.(row) ?? `${action.label}: xong.`);
      list.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      actionFlight.current = false;
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

      {config.intro && (typeof config.intro === "function" ? config.intro(user) : config.intro)}
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
                              disabled={offline || runningId !== null}
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
                            {...(a.newTab ? { target: "_blank", rel: "noopener" } : {})}
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
                          label={config.deleteLocked?.(row, user) || `Xóa ${nameOf(row)}`}
                          onClick={() => setConfirm(row)}
                          disabled={offline || !!config.deleteLocked?.(row, user)}
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
              {shownFields(form.mode, form.values).map((f) => f.type === "image" ? (
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
                  min={fieldOption(f, "min", form.values, form.mode)}
                  max={fieldOption(f, "max", form.values, form.mode)}
                  step={f.step}
                  help={f.help}
                  placeholder={f.placeholder}
                  options={f.optionsFrom ? f.optionsFrom(lk, user, form.values) : f.options}
                  roleOptions={f.roleOptions}
                  value={form.values[f.name]}
                  onChange={setValue}
                  error={errors[f.name]}
                />
              ))}
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!confirm}
        title={`Xóa ${config.singular.toLowerCase()}?`}
        onClose={() => !deleting && setConfirm(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={deleting}>
              Giữ lại
            </Button>
            <Button variant="danger" onClick={remove} disabled={deleting}>
              {deleting ? "Đang kiểm tra và xóa…" : "Xóa"}
            </Button>
          </>
        }
      >
        {confirm && (
          <p>
            {config.deleteMessage
              ? (typeof config.deleteMessage === "function" ? config.deleteMessage(confirm) : config.deleteMessage)
              : <>Yêu cầu xóa “{nameOf(confirm)}” sẽ được gửi tới máy chủ. Nếu dữ liệu khác vẫn đang dùng mục này, máy chủ sẽ từ chối và cho biết lý do.</>}
          </p>
        )}
      </Modal>

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
