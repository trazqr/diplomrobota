import { useCallback, useRef, useState } from 'react'

import clansHeroBg from '../assets/clans_hero_bg.jpg'
import * as api from '../utils/api'
import { useApiResource } from '../hooks/useApiResource'
import { resolveSiteImage } from '../data/images'
import { localizeClass, localizeRace } from '../data/dndTraits'
import { DiceDivider } from '../components/Dice'
import { apiErrorMessage } from '../utils/apiErrors'
import UserLink from '../components/UserLink'
import PagedList from '../components/PagedList'
import ConfirmDialog from '../components/ConfirmDialog'
import { isSupportedImageFile, resizeImage } from '../utils/image'

const ROLE_LABELS = {
  owner: ['Власник', 'Owner'],
  officer: ['Офіцер', 'Officer'],
  member: ['Учасник', 'Member'],
}

function roleLabel(role, isEn) {
  const pair = ROLE_LABELS[role]
  if (!pair) return role
  return isEn ? pair[1] : pair[0]
}

const FLAG_MAX_SIDE = 512
const FLAG_MAX_LENGTH = 280_000

function ClanFlagPicker({ value, isEn, busy, onPick, onClear }) {
  const inputRef = useRef(null)
  const [problem, setProblem] = useState('')
  const [working, setWorking] = useState(false)

  const take = async file => {
    setProblem('')
    if (!file) return

    if (!isSupportedImageFile(file)) {
      setProblem(
        isEn ? 'Choose an image (PNG, JPG, GIF…).' : 'Оберіть зображення (PNG, JPG, GIF…).',
      )
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setProblem(isEn ? 'File is too large. Maximum 4 MB.' : 'Файл завеликий. Максимум 4 МБ.')
      return
    }

    setWorking(true)
    try {
      const data = await resizeImage(file, {
        maxSide: FLAG_MAX_SIDE,
        maxLength: FLAG_MAX_LENGTH,
      })
      await onPick(data)
    } catch {
      setProblem(isEn ? 'Could not process the image.' : 'Не вдалося опрацювати зображення.')
    } finally {
      setWorking(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const disabled = busy || working

  return (
    <div className="clan-flag-picker">
      <div className="clan-flag-preview">
        {value ? (
          <img src={resolveSiteImage(value)} alt="" />
        ) : (
          <span className="clan-flag-empty">{isEn ? 'No flag' : 'Без прапора'}</span>
        )}
      </div>

      <div className="clan-flag-controls">
        <input
          ref={inputRef}
          className="clan-flag-input"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          disabled={disabled}
          onChange={event => take(event.target.files?.[0])}
        />
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {working
            ? isEn
              ? 'Processing…'
              : 'Обробка…'
            : value
              ? isEn
                ? 'Replace flag'
                : 'Замінити прапор'
              : isEn
                ? 'Upload flag'
                : 'Завантажити прапор'}
        </button>
        {value && onClear && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={disabled}
            onClick={() => onClear()}
          >
            {isEn ? 'Remove' : 'Прибрати'}
          </button>
        )}
        {problem && <span className="clan-flag-problem">{problem}</span>}
      </div>
    </div>
  )
}

function ClanMemberRow({
  member,
  isEn,
  lang,
  canManage,
  canRemoveMembers,
  isSiteAdmin,
  myRole,
  meId,
  onAction,
  onRemove,
  busy,
}) {
  const isOwner = member.role === 'owner'
  const isSelf = member.userId === meId
  const canSetRole = canManage && myRole === 'owner' && !isOwner && !isSelf
  const canRemove =
    canRemoveMembers &&
    !isSelf &&
    (isSiteAdmin || (!isOwner && (myRole === 'owner' || member.role === 'member')))
  const canTouch = canSetRole || canRemove

  return (
    <li className="clan-member">
      <img className="clan-member-avatar" src={resolveSiteImage(member.avatar)} alt="" />

      <div className="clan-member-main">
        <UserLink login={member.login} className="clan-member-name">
          {member.name || member.login}
        </UserLink>
        <span className="clan-member-meta">
          {localizeClass(member.charClass, lang)} · {localizeRace(member.race, lang)} ·{' '}
          {isEn ? 'level' : 'рівень'} {member.level}
        </span>
      </div>

      <span className={`badge badge-role role-${member.role}`}>{roleLabel(member.role, isEn)}</span>

      {canTouch && (
        <div className="clan-member-actions">
          {canSetRole && (
            <button
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() =>
                onAction('role', member.userId, member.role === 'officer' ? 'member' : 'officer')
              }
            >
              {member.role === 'officer'
                ? isEn
                  ? 'Demote'
                  : 'Зняти офіцера'
                : isEn
                  ? 'Make officer'
                  : 'Зробити офіцером'}
            </button>
          )}
          {canSetRole && (
            <button
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() => onAction('transfer', member.userId)}
            >
              {isEn ? 'Hand over' : 'Передати клан'}
            </button>
          )}
          {canRemove && (
            <button
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() => onRemove(member)}
            >
              {isEn ? 'Remove' : 'Виключити'}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

function ClanRoster({
  clanId,
  status,
  title,
  initial,
  total,
  initialHasMore,
  pageSize,
  isEn,
  searchable,
  renderRow,
}) {
  const fetchPage = useCallback(
    ({ q, page, pageSize: take }) =>
      api.fetchClanMembers(clanId, { q, status, page, pageSize: take }),
    [clanId, status],
  )

  return (
    <PagedList
      initial={initial}
      total={total}
      initialHasMore={initialHasMore}
      pageSize={pageSize}
      isEn={isEn}
      searchable={searchable}
      searchPlaceholder={isEn ? 'Search by name or login' : 'Пошук за іменем або логіном'}
      searchLabel={isEn ? 'Search the roster' : 'Пошук у складі'}
      emptyText={isEn ? 'Nobody found.' : 'Нікого не знайдено.'}
      fetchPage={fetchPage}
      listClassName="clan-members"
      renderRow={renderRow}
      header={counter =>
        title || counter ? (
          <h3 className="clan-section-title">
            {title}
            {counter && (
              <span className="paged-count">
                {title ? ' ' : ''}
                {counter}
              </span>
            )}
          </h3>
        ) : null
      }
    />
  )
}

function ClanDetail({ clanId, lang, isEn, authUser, onRequestAuth, onBack, onChanged }) {
  const viewerKey = authUser?.login ?? ''
  const load = useCallback(() => api.fetchClan(clanId), [clanId, viewerKey])
  const clan = useApiResource(load)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', tag: '', description: '', emblem: '' })

  const data = clan.data
  if (clan.status === 'loading') {
    return <p className="offline-banner">{isEn ? 'Loading clan…' : 'Завантаження клану…'}</p>
  }
  if (clan.status === 'error' || !data) {
    return (
      <p className="offline-banner">
        {isEn ? 'Could not load the clan.' : 'Не вдалося завантажити клан.'}
      </p>
    )
  }

  const meId = data.meId ?? null

  const startEditing = () => {
    setForm({
      name: data.name,
      tag: data.tag,
      description: data.description || '',
      emblem: data.emblem || '',
    })
    setError('')
    setEditing(true)
  }

  const saveClan = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.updateClan(clanId, form)
      setEditing(false)
      clan.reload?.()
      onChanged?.()
    } catch (problem) {
      setError(apiErrorMessage(problem, lang))
    } finally {
      setBusy(false)
    }
  }

  const askDisband = () =>
    setConfirm({
      kind: 'disband',
      title: isEn ? 'Disband the clan?' : 'Розпустити клан?',
      label: isEn ? 'Disband' : 'Розпустити',
      text: isEn
        ? `«${data.name}» will be deleted permanently along with its roster of ${data.memberCount}. This cannot be undone.`
        : `«${data.name}» буде видалено назавжди разом зі складом із ${data.memberCount} учасників. Цю дію неможливо скасувати.`,
    })

  const askRemove = member =>
    setConfirm({
      kind: 'remove',
      userId: member.userId,
      title: isEn ? 'Remove from the clan?' : 'Виключити з клану?',
      label: isEn ? 'Remove' : 'Виключити',
      text: isEn
        ? `${member.name || member.login} will lose their place in «${data.name}» and will have to apply again.`
        : `${member.name || member.login} втратить місце в клані «${data.name}» і зможе повернутися лише за новою заявкою.`,
    })

  const askLeave = () =>
    setConfirm({
      kind: 'remove',
      userId: meId,
      title: isEn ? 'Leave the clan?' : 'Залишити клан?',
      label: isEn ? 'Leave' : 'Залишити',
      text: isEn
        ? `You will leave «${data.name}». To come back you will need a new request and approval.`
        : `Ви залишите клан «${data.name}». Щоб повернутися, знадобиться нова заявка та схвалення.`,
    })

  const otherClan = data.myClan && data.myClan.id !== data.id ? data.myClan : null

  const alreadyInClanText = name =>
    isEn
      ? `You already belong to «${name}». Leave it first to apply here.`
      : `Ви вже в клані «${name}». Спершу залиште його, щоб подати заявку сюди.`

  const run = async (kind, userId, role) => {
    if (!authUser) {
      onRequestAuth?.()
      return
    }
    if (kind === 'join' && otherClan) {
      setError(alreadyInClanText(otherClan.name))
      return
    }

    setBusy(true)
    setError('')
    try {
      if (kind === 'join') await api.joinClan(clanId)
      if (kind === 'approve') await api.approveClanMember(clanId, userId)
      if (kind === 'remove') await api.removeClanMember(clanId, userId)
      if (kind === 'role') await api.setClanMemberRole(clanId, userId, role)
      if (kind === 'transfer') await api.transferClan(clanId, userId)
      if (kind === 'disband') {
        await api.deleteClan(clanId)
        onChanged?.()
        onBack()
        return
      }
      clan.reload?.()
      onChanged?.()
    } catch (problem) {
      if (problem?.code === 'already_in_clan' && data.myClan) {
        setError(alreadyInClanText(data.myClan.name))
      } else {
        setError(apiErrorMessage(problem, lang))
      }
      clan.reload?.()
    } finally {
      setBusy(false)
    }
  }

  const canJoin = authUser && !data.myStatus
  const isPending = data.myStatus === 'pending'
  const isMember = data.myStatus === 'active'

  return (
    <div className="clan-detail">
      <button className="article-back" onClick={onBack}>
        ← {isEn ? 'All clans' : 'Усі клани'}
      </button>

      <header className="clan-detail-head">
        {data.emblem && <img className="clan-emblem" src={resolveSiteImage(data.emblem)} alt="" />}
        <div>
          <h2 className="clan-detail-name">
            {data.name} <span className="clan-tag">[{data.tag}]</span>
          </h2>
          <p className="clan-detail-meta">
            {isEn ? 'Led by' : 'Очолює'}{' '}
            <UserLink login={data.owner.login}>{data.owner.name || data.owner.login}</UserLink> ·{' '}
            {data.memberCount} {isEn ? 'members' : 'учасників'}
          </p>
        </div>

        <div className="clan-detail-actions">
          {canJoin && (
            <button className="btn btn-action" disabled={busy} onClick={() => run('join')}>
              {isEn ? 'Apply to join' : 'Подати заявку'}
            </button>
          )}
          {isPending && (
            <span className="clan-note">{isEn ? 'Request pending' : 'Заявку надіслано'}</span>
          )}
          {isMember && (
            <button className="btn btn-outline" disabled={busy} onClick={askLeave}>
              {isEn ? 'Leave clan' : 'Залишити клан'}
            </button>
          )}
          {data.canManage && !editing && (
            <button className="btn btn-outline" disabled={busy} onClick={startEditing}>
              {isEn ? 'Edit clan' : 'Редагувати клан'}
            </button>
          )}
          {data.canDisband && (
            <button className="btn btn-outline btn-danger" disabled={busy} onClick={askDisband}>
              {isEn ? 'Disband clan' : 'Розпустити клан'}
            </button>
          )}
        </div>
      </header>

      {editing ? (
        <form className="clan-edit" onSubmit={saveClan}>
          <ClanFlagPicker
            value={form.emblem}
            isEn={isEn}
            busy={busy}
            onPick={emblem => setForm(prev => ({ ...prev, emblem }))}
            onClear={() => setForm(prev => ({ ...prev, emblem: '' }))}
          />

          <div className="clan-create-row">
            <input
              className="modal-input"
              placeholder={isEn ? 'Clan name' : 'Назва клану'}
              value={form.name}
              maxLength={40}
              onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
            />
            <input
              className="modal-input clan-create-tag"
              placeholder={isEn ? 'Tag' : 'Мітка'}
              value={form.tag}
              maxLength={6}
              onChange={event => setForm(prev => ({ ...prev, tag: event.target.value }))}
            />
          </div>

          <textarea
            className="modal-input"
            placeholder={
              isEn
                ? 'What the clan is about, who you are looking for, when you play…'
                : 'Про що клан, кого шукаєте, коли граєте…'
            }
            value={form.description}
            maxLength={500}
            rows={5}
            onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
          />
          <span className="clan-counter">{form.description.length} / 500</span>

          <div className="clan-edit-actions">
            <button className="btn btn-action" disabled={busy}>
              {isEn ? 'Save' : 'Зберегти'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              {isEn ? 'Cancel' : 'Скасувати'}
            </button>
          </div>
        </form>
      ) : data.description ? (
        <p className="clan-description">{data.description}</p>
      ) : (
        data.canManage && (
          <p className="clan-description is-empty">
            {isEn
              ? 'No description yet. Press «Edit clan» to tell people what you are about.'
              : 'Опису ще немає. Натисніть «Редагувати клан», щоб розповісти про себе.'}
          </p>
        )
      )}
      {error && <p className="offline-banner">{error}</p>}

      <ClanRoster
        clanId={clanId}
        status="active"
        initial={data.members}
        total={data.memberCount}
        initialHasMore={data.membersHasMore}
        pageSize={data.membersPageSize}
        isEn={isEn}
        searchable
        renderRow={member => (
          <ClanMemberRow
            key={member.userId}
            member={member}
            isEn={isEn}
            lang={lang}
            canManage={data.canManage}
            canRemoveMembers={data.canRemoveMembers}
            isSiteAdmin={data.isSiteAdmin}
            myRole={data.myRole}
            meId={meId}
            busy={busy}
            onAction={run}
            onRemove={askRemove}
          />
        )}
      />

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          text={confirm.text}
          confirmLabel={confirm.label}
          isEn={isEn}
          busy={busy}
          onConfirm={async () => {
            const pending = confirm
            setConfirm(null)
            await run(pending.kind, pending.userId)
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {data.canManage && data.pending.length > 0 && (
        <ClanRoster
          clanId={clanId}
          status="pending"
          title={isEn ? 'Requests' : 'Заявки'}
          initial={data.pending}
          total={data.pendingCount}
          initialHasMore={data.pendingHasMore}
          pageSize={data.membersPageSize}
          isEn={isEn}
          renderRow={member => (
            <li className="clan-member" key={member.userId}>
              <img className="clan-member-avatar" src={resolveSiteImage(member.avatar)} alt="" />
              <div className="clan-member-main">
                <UserLink login={member.login} className="clan-member-name">
                  {member.name || member.login}
                </UserLink>
                <span className="clan-member-meta">
                  {localizeClass(member.charClass, lang)} · {localizeRace(member.race, lang)}
                </span>
              </div>
              <div className="clan-member-actions">
                <button
                  className="btn btn-action btn-sm"
                  disabled={busy}
                  onClick={() => run('approve', member.userId)}
                >
                  {isEn ? 'Accept' : 'Прийняти'}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  disabled={busy}
                  onClick={() => run('remove', member.userId)}
                >
                  {isEn ? 'Decline' : 'Відхилити'}
                </button>
              </div>
            </li>
          )}
        />
      )}
    </div>
  )
}

function CreateClanForm({ isEn, lang, onCreated, myClan }) {
  const [form, setForm] = useState({ name: '', tag: '', description: '', emblem: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    if (myClan) {
      setError(
        isEn
          ? `You already belong to «${myClan.name}». Leave it first to found a new one.`
          : `Ви вже в клані «${myClan.name}». Спершу залиште його, щоб заснувати новий.`,
      )
      return
    }

    setBusy(true)
    setError('')
    try {
      const created = await api.createClan(form)
      setForm({ name: '', tag: '', description: '', emblem: '' })
      onCreated?.(created.id)
    } catch (problem) {
      setError(apiErrorMessage(problem, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="clan-create" onSubmit={submit}>
      <h3 className="clan-section-title">{isEn ? 'Found a clan' : 'Заснувати клан'}</h3>

      <ClanFlagPicker
        value={form.emblem}
        isEn={isEn}
        busy={busy}
        onPick={data => setForm(prev => ({ ...prev, emblem: data }))}
        onClear={() => setForm(prev => ({ ...prev, emblem: '' }))}
      />

      <div className="clan-create-row">
        <input
          className="modal-input"
          placeholder={isEn ? 'Clan name' : 'Назва клану'}
          value={form.name}
          maxLength={40}
          onChange={e => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="modal-input clan-create-tag"
          placeholder={isEn ? 'Tag' : 'Мітка'}
          value={form.tag}
          maxLength={6}
          onChange={e => setForm({ ...form, tag: e.target.value })}
        />
      </div>

      <textarea
        className="modal-input"
        rows={3}
        maxLength={500}
        placeholder={isEn ? 'What is this clan about?' : 'Про що цей клан?'}
        value={form.description}
        onChange={e => setForm({ ...form, description: e.target.value })}
      />

      {error && <p className="offline-banner">{error}</p>}

      <button className="btn btn-action" disabled={busy || !form.name.trim()}>
        {busy ? (isEn ? 'Creating…' : 'Створення…') : isEn ? 'Create clan' : 'Створити клан'}
      </button>
    </form>
  )
}

export default function ClansPage({ lang, authUser, onRequestAuth, initialClanId = null }) {
  const isEn = lang === 'en'
  const loadClans = useCallback(() => api.fetchClans(), [])
  const clans = useApiResource(loadClans)
  const [openId, setOpenId] = useState(initialClanId)

  const items = clans.data?.items || []
  const myClan = clans.data?.myClan || null

  return (
    <>
      <section
        className="clans-hero"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.6)), url(${clansHeroBg})`,
        }}
      >
        <div className="hero-content">
          <h1 className="wordmark">
            <span className="wordmark-word">{isEn ? 'CLANS' : 'КЛАНИ'}</span>
          </h1>
          <p className="hero-subtitle">
            {isEn
              ? 'Gather a party, hold a banner, keep your roster in one place.'
              : 'Збирайте загін, тримайте прапор і склад команди в одному місці.'}
          </p>
        </div>
      </section>

      <section className="clans-section">
        {openId ? (
          <ClanDetail
            clanId={openId}
            lang={lang}
            isEn={isEn}
            authUser={authUser}
            onRequestAuth={onRequestAuth}
            onBack={() => setOpenId(null)}
            onChanged={() => clans.reload?.()}
          />
        ) : (
          <>
            {clans.status === 'loading' && (
              <p className="offline-banner">{isEn ? 'Loading clans…' : 'Завантаження кланів…'}</p>
            )}
            {clans.status === 'error' && (
              <p className="offline-banner">
                {isEn
                  ? 'Could not load clans from the server.'
                  : 'Не вдалося завантажити клани із сервера.'}
              </p>
            )}

            {clans.status === 'ready' && items.length === 0 && (
              <p className="clan-empty">
                {isEn
                  ? 'No clans yet. Found the first one.'
                  : 'Кланів поки немає. Заснуйте перший.'}
              </p>
            )}

            <ul className="clan-list">
              {items.map(clan => (
                <li key={clan.id}>
                  <button className="clan-card" onClick={() => setOpenId(clan.id)}>
                    {clan.emblem && (
                      <img
                        className="clan-card-emblem"
                        src={resolveSiteImage(clan.emblem)}
                        alt=""
                      />
                    )}
                    <span className="clan-card-name">
                      {clan.name} <span className="clan-tag">[{clan.tag}]</span>
                    </span>
                    <span className="clan-card-meta">
                      {clan.memberCount} {isEn ? 'members' : 'учасників'} ·{' '}
                      {clan.owner.name || clan.owner.login}
                    </span>
                    {clan.description && <span className="clan-card-desc">{clan.description}</span>}
                  </button>
                </li>
              ))}
            </ul>

            <DiceDivider />

            {authUser && (
              <CreateClanForm
                isEn={isEn}
                lang={lang}
                myClan={myClan}
                onCreated={id => {
                  clans.reload()
                  setOpenId(id)
                }}
              />
            )}
            {!authUser && (
              <p className="clan-empty">
                {isEn
                  ? 'Sign in to found a clan or join one.'
                  : 'Увійдіть, щоб заснувати клан або вступити до наявного.'}
              </p>
            )}
          </>
        )}
      </section>
    </>
  )
}
