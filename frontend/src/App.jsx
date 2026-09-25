import { useState, useEffect } from 'react'
import { useAuth } from './auth/useAuth'
import ThemeCursor from './components/ThemeCursor'
import AuthModal from './components/AuthModal'

import Navbar from './components/Navbar'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import RulesPage from './pages/RulesPage'
import CampaignsPage from './pages/CampaignsPage'
import NewsPage from './pages/NewsPage'
import ProfilePage from './pages/ProfilePage'
import ArticlesPage from './pages/ArticlesPage'
import CharactersPage from './pages/CharactersPage'
import ArticlePage from './pages/ArticlePage'
import NewsItemPage from './pages/NewsItemPage'
import AdminNewsPage from './pages/AdminNewsPage'
import ArticleEditor from './components/ArticleEditor'
import Wanderers from './components/Wanderers'
import ClansPage from './pages/ClansPage'
import UserProfilePage from './pages/UserProfilePage'
import { useOverlayTransition } from './hooks/useOverlayTransition'

const LANGUAGE_STORAGE_KEY = 'dnd_language'

function normalizeLanguage(value) {
  return value === 'en' ? 'en' : 'ua'
}

function readStoredLanguage() {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY))
  } catch {
    return 'ua'
  }
}

function storeLanguage(value) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, value)
  } catch {}
}

const text = {
  ua: {
    home: 'ГОЛОВНА',
    rules: 'ПРАВИЛА D&D',
    characters: 'ПЕРСОНАЖІ',
    account: 'АККАУНТ',
    campaigns: 'КАМПАНІЇ',
    news: 'D&D НОВИНИ',
    playNow: 'ГРАТИ ЗАРАЗ',

    heroTitle: 'DUNGEONS & DRAGONS',
    heroDesc:
      'Керуйте Тіньовим Легіоном. Знищуйте героїв, підкорюйте королівства. Мертві у вашій владі в цій неперевершеній масштабній стратегічній рольовій грі.',
    seeMore: 'ДІЗНАТИСЯ БІЛЬШЕ',
    aboutTitle: 'Що таке Dungeons & Dragons?',
    aboutDesc:
      'Dungeons & Dragons (D&D) – це легендарна фентезійна настільна рольова гра, яка стала піонером цього жанру. У D&D гравці створюють унікальних персонажів для дослідження уявних світів. Під керівництвом Майстра Підземель (DM), який виступає в ролі судді та оповідача, гравці працюють разом, щоб боротися з монстрами, розгадувати головоломки та розкривати таємниці. Кожне рішення може кардинально змінити розповідь, забезпечуючи унікальний та спільний досвід для кожної сторони.',
    newsTitle: 'D&D Новини',
    ctaTitle: 'Готові почати? Знайдіть гру',
    ctaDesc:
      'Скористайтеся нашим інструментом пошуку групи, щоб знайти досвідченого Майстра гри та компанію нових друзів для гри.',
    ctaBtn: 'ПРИЄДНУЙТЕСЯ ДО ГРИ',

    rulesHeroLine1: 'ПРАВИЛА ГРИ',
    rulesHeroLine2: 'DUNGEONS & DRAGONS',
    rulesHeroSubtitle:
      'Усе, що потрібно знати перед першою сесією: як створюють персонажа, навіщо кидають кубики і як минає гра за столом.',
    rulesCcTitle: 'СТВОРЕННЯ ПЕРСОНАЖА',
    rulesCcDesc:
      'Створення власного персонажа — це не просто крок до гри, це процес творчості, занурення в ігровий світ та самовираження. Вибираючи расу та клас, ви створюєте унікальну легенду, де кожна деталь вашого персонажа має значення, від його передісторії до майбутнього.',
    forbiddenTitle: 'Заборонені правила',

    campaignsHeroTitle: 'КАМПАНІЇ',
    campaignsHeroSubtitle:
      'Готові пригоди з описами, локаціями та нотатками Майстра. Оберіть кампанію і зберіть групу за кілька хвилин.',
    campFeature1Title: 'Створюйте та керуйте кампаніями',
    campFeature1Desc:
      'Просто створюйте власні кампанії або використовуйте готові пригоди. Налаштуйте сюжет, додайте описи, карти, завдання та персонажів. Усі матеріали кампанії зберігаються в одному місці.',
    campFeature2Title: 'Розвивайте сюжет разом із гравцями',
    campFeature2Desc:
      'Відстежуйте важливі події та ведіть історію пригод від першої зустрічі до фінальної битви. Кожне рішення гравців впливає на розвиток сюжету.',
    campExploreTitle: 'Досліджуйте готові пригоди',
    campExploreDesc:
      'Оберіть з колекції готових кампаній з унікальними сюжетами, локаціями та завданнями. Почніть гру за лічені хвилини або використовуйте улюблену пригоду як основу для власної історії.',
    campaignsListTitle: 'Кампанії',

    newsPageTitle: 'D&D НОВИНИ',
    newsHeroSubtitle:
      'Анонси, огляди книг та інтерв’ю з творцями гри. Найважливіше зі світу Dungeons & Dragons — в одному місці.',
    newsMainTitle: 'ГОЛОВНІ НОВИНИ:\nМУЛЬТИВСЕСВІТ D&D',
    newsMainSubtitle:
      "Будьте в курсі останніх новин у світі Dungeons & Dragons. Свіжі анонси, огляди книг, інтерв'ю та важливі зміни. Будьте першими, хто дізнається!",
    expertTitle: 'ІНСТРУМЕНТИ ЕКСПЕРТА З ПІДЗЕМЕЛ:\nРОЗКРИТТЯ ЕКРАНУ',
    expertIntro:
      'Цього сезону D&D News заглиблюються у мистецтво професійного освоєння підземель. Ми представляємо ексклюзивну серію посібників, доступних з 15 серпня.',
    expertPoint1:
      'Спеціальний вебінар: Майстер-клас з налаштування екрана, керування прихованими зустрічами та динамічного темпу. Тривалість: 3 години.',
    expertPoint2:
      'Чотири щотижневі посібники для майстра гри: Детальні статті з шаблонами сценаріїв, щоб покращити вашу гру. Кожен посібник – 2-годинний досвід.',
    expertPoint3:
      "П'ять спеціальних інструментів: Шпаргалка з правилами, трекер наративу, трекер ініціативи, все інтегровано з D&D Beyond.",

    editProfile: 'Редагувати профіль',
    chooseAvatar: 'Оберіть аватар',
    username: "Ім'я персонажа",
    characterClass: 'Клас',
    race: 'Раса',
    level: 'Рівень (1–20)',
    bio: 'Біографія',
    bioPlaceholder: 'Розкажіть про свого персонажа...',
    cancel: 'Скасувати',
    save: 'Зберегти',
    levelLabel: 'Рівень {n}',
    bioTitle: 'Біографія',
    bioEmpty: 'Ще немає біографії. Натисніть «Редагувати профіль», щоб додати свою історію.',
    statsTitle: 'Статистика',
    statLevel: 'Рівень',
    statArticles: 'Статті',
    statComments: 'Коментарі',
    statLikes: 'Вподобання',
    recentTitle: 'Остання активність',

    articles: 'СТАТТІ',
    clans: 'КЛАНИ',
    artEyebrow: 'ФОРУМ СПІЛЬНОТИ',
    artHeroTitle: 'СТАТТІ ТА ОБГОВОРЕННЯ',
    artHeroSubtitle:
      'Діліться знаннями, теоріями та лором зі спільнотою D&D. Пишіть статті, залишайте лайки та надихайте інших пригодників.',
    artWriteBtn: 'НАПИСАТИ СТАТТЮ',
    artReadBtn: 'Читати далі',
    artSortLabel: 'Сортувати:',
    artSortDate: 'За датою',
    artSortLikes: 'За лайками',
    artEmpty: 'Статей у цій категорії ще немає. Будьте першим!',
    artModalTitle: 'Нова стаття',
    artFormTitle: 'Заголовок',
    artFormTitlePlaceholder: 'Введіть заголовок статті...',
    artFormCategory: 'Категорія',
    artFormContent: 'Зміст статті',
    artFormContentPlaceholder:
      'Напишіть вашу статтю... Підтримується **жирний** текст через подвійні зірочки.',
    artPublishBtn: 'ОПУБЛІКУВАТИ',
    artErrorTitle: 'Будь ласка, введіть заголовок.',
    artErrorContent: 'Будь ласка, напишіть зміст статті.',
    artLike: 'Вподобати',
    artUnlike: 'Прибрати лайк',
    artDelete: 'Видалити статтю',

    footerCompany: 'КОМПАНІЯ',
    footerFollow: 'ПІДПИСУЙТЕСЬ НА НАС',
  },
  en: {
    home: 'HOME',
    rules: 'RULES D&D',
    characters: 'CHARACTERS',
    account: 'ACCOUNT',
    campaigns: 'CAMPAIGNS',
    news: 'D&D NEWS',
    playNow: 'PLAY NOW',

    heroTitle: 'DUNGEONS & DRAGONS',
    heroDesc:
      'Command the Shadow Legion. Slay heroes, conquer realms. The dead are yours to rule in this definitive grand strategy roleplaying game.',
    seeMore: 'SEE MORE',
    aboutTitle: 'What is Dungeons & Dragons?',
    aboutDesc:
      'Dungeons & Dragons (D&D) is a legendary fantasy tabletop role-playing game that pioneered the genre. In D&D, players create unique characters to explore imaginary worlds. Guided by a Dungeon Master (DM) who serves as referee and storyteller, players work together to battle monsters, solve puzzles, and uncover secrets.',
    newsTitle: 'D&D News',
    ctaTitle: 'Ready to start? Find a game',
    ctaDesc:
      'Use our group finder tool to find an experienced Game Master and a party of new friends to play with.',
    ctaBtn: 'JOIN THE GAME',

    rulesHeroLine1: 'GAME RULES',
    rulesHeroLine2: 'DUNGEONS & DRAGONS',
    rulesHeroSubtitle:
      'Everything you need before the first session: how characters are made, why dice are rolled and how a game at the table unfolds.',
    rulesCcTitle: 'CHARACTER CREATION',
    rulesCcDesc:
      'Creating your own character is not just a step toward the game — it is a process of creativity, immersion into the game world, and self-expression. By choosing a race and class, you create a unique legend where every detail has meaning.',
    forbiddenTitle: 'Forbidden Rules',

    campaignsHeroTitle: 'CAMPAIGNS',
    campaignsHeroSubtitle:
      'Ready-made adventures with descriptions, locations and Dungeon Master notes. Pick a campaign and gather a party in minutes.',
    campFeature1Title: 'Create and Manage Campaigns',
    campFeature1Desc:
      'Easily create your own campaigns or use ready-made adventures. Customize the plot, add descriptions, maps, quests and characters. All campaign materials are stored in one place.',
    campFeature2Title: 'Develop the story with your players',
    campFeature2Desc:
      "Track important events and keep the adventure's history from the first meeting to the final battle. Every player decision affects the plot.",
    campExploreTitle: 'Explore Ready-Made Adventures',
    campExploreDesc:
      'Choose from a collection of ready-made campaigns with unique plots, locations and quests. Start playing in minutes or use your favorite adventure as the basis for your own story.',
    campaignsListTitle: 'Campaigns',

    newsPageTitle: 'D&D NEWS',
    newsHeroSubtitle:
      'Announcements, book reviews and interviews with the makers of the game. The most important things from the world of Dungeons & Dragons, in one place.',
    newsMainTitle: 'MAIN NEWS:\nD&D MULTIVERSE',
    newsMainSubtitle:
      'Stay up to date with the latest news in the world of Dungeons & Dragons. Fresh announcements, book reviews, interviews and important changes. Be the first to know!',
    expertTitle: 'EXPERT DUNGEON MASTER TOOLS:\nSCREEN REVELATION',
    expertIntro:
      'This season D&D News dives deep into the art of professional dungeon mastering. We introduce an exclusive series of expert guides and materials, available from August 15.',
    expertPoint1:
      'Special webinar: Screen setup masterclass, managing hidden encounters, and dynamic pacing. Duration: 3 hours.',
    expertPoint2:
      'Four weekly GM guides: In-depth articles with printouts and adventure templates to fill your screen and improve your play. Each guide is a 2-hour experience.',
    expertPoint3:
      'Five special GM tools: Includes rules cheat sheet, narrative tracker, initiative tracker, and links to legendary creatures, all integrated with D&D Beyond.',

    editProfile: 'Edit Profile',
    chooseAvatar: 'Choose Avatar',
    username: 'Character Name',
    characterClass: 'Class',
    race: 'Race',
    level: 'Level (1–20)',
    bio: 'Biography',
    bioPlaceholder: 'Tell us about your character...',
    cancel: 'Cancel',
    save: 'Save',
    levelLabel: 'Level {n}',
    bioTitle: 'Biography',
    bioEmpty: 'No biography yet. Click "Edit Profile" to add yours.',
    statsTitle: 'Statistics',
    statLevel: 'Level',
    statArticles: 'Articles',
    statComments: 'Comments',
    statLikes: 'Likes',
    recentTitle: 'Recent Activity',

    articles: 'ARTICLES',
    clans: 'CLANS',
    artEyebrow: 'COMMUNITY FORUM',
    artHeroTitle: 'ARTICLES & DISCUSSION',
    artHeroSubtitle:
      'Share knowledge, theories and lore with the D&D community. Write articles, leave likes and inspire fellow adventurers.',
    artWriteBtn: 'WRITE AN ARTICLE',
    artReadBtn: 'Read more',
    artSortLabel: 'Sort by:',
    artSortDate: 'Date',
    artSortLikes: 'Likes',
    artEmpty: 'No articles in this category yet. Be the first!',
    artModalTitle: 'New Article',
    artFormTitle: 'Title',
    artFormTitlePlaceholder: 'Enter article title...',
    artFormCategory: 'Category',
    artFormContent: 'Article Content',
    artFormContentPlaceholder:
      'Write your article... Supports **bold** text using double asterisks.',
    artPublishBtn: 'PUBLISH',
    artErrorTitle: 'Please enter a title.',
    artErrorContent: 'Please write some content.',
    artLike: 'Like',
    artUnlike: 'Unlike',
    artDelete: 'Delete article',

    footerCompany: 'COMPANY',
    footerFollow: 'FOLLOW US',
  },
}

const PAGE_KEYS = [
  'home',
  'rules',
  'characters',
  'campaigns',
  'news',
  'profile',
  'articles',
  'clans',
  'admin',
]

const ENTITY_ROUTES = ['article', 'news-item', 'clans']

const LOGIN_PATTERN = /^[\p{L}\p{N}._-]{3,32}$/u

function routeFromHash() {
  const raw = window.location.hash.replace(/^#/, '')
  const [head, param] = raw.split('/')

  if (ENTITY_ROUTES.includes(head) && param) {
    const num = Number(param)
    if (Number.isInteger(num) && num > 0) return { tab: head, id: num }
  }
  if (head === 'user' && param) {
    const login = decodeURIComponent(param)
    if (LOGIN_PATTERN.test(login)) return { tab: 'user', id: login }
  }
  if (PAGE_KEYS.includes(head)) return { tab: head, id: null }

  const snap = globalThis.__OD_SNAP_TAB__
  return { tab: PAGE_KEYS.includes(snap) ? snap : 'home', id: null }
}

function App() {
  const { user: authUser, profile, acceptUser, logout, saveProfile } = useAuth()
  const [lang, setCurrentLanguage] = useState(readStoredLanguage)
  const [route, setRoute] = useState(routeFromHash)
  const [showAuth, setShowAuth] = useState(false)
  const [externalAuthError, setExternalAuthError] = useState('')
  const [editorArticle, setEditorArticle] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('authError')
    if (!code) return

    setExternalAuthError(code)
    setShowAuth(true)
    params.delete('authError')
    const query = params.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    )
  }, [])

  const [profileError, setProfileError] = useState('')

  const activeTab = route.tab
  const authOverlay = useOverlayTransition(showAuth)
  const editorOverlay = useOverlayTransition(editorArticle)

  const setLang = value => {
    const nextLanguage = normalizeLanguage(value)
    setCurrentLanguage(nextLanguage)
    storeLanguage(nextLanguage)
  }

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const current = routeFromHash()
    if (current.tab !== route.tab || current.id !== route.id) {
      window.location.hash = route.id
        ? `${route.tab}/${route.id}`
        : route.tab === 'home'
          ? ''
          : route.tab
    }

    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [route])

  const setActiveTab = tab => setRoute({ tab, id: null })
  const backFromUser = () => {
    if (window.history.length > 1) window.history.back()
    else setActiveTab('home')
  }
  const openArticle = id => setRoute({ tab: 'article', id })
  const openNewsItem = id => setRoute({ tab: 'news-item', id })

  const handleSaveProfile = async newProfile => {
    if (!authUser) {
      setShowAuth(true)
      return false
    }

    setProfileError('')
    try {
      await saveProfile(newProfile)
      return true
    } catch (err) {
      setProfileError(
        err?.code === 'avatar_too_large'
          ? lang === 'en'
            ? 'The picture is too large — pick a smaller one.'
            : 'Зображення завелике — оберіть менше.'
          : lang === 'en'
            ? 'Could not save the profile. Try again.'
            : 'Не вдалося зберегти профіль. Спробуйте ще раз.',
      )
      return false
    }
  }

  const t = text[lang]

  const pages = {
    home: <HomePage t={t} />,
    rules: <RulesPage t={t} lang={lang} />,
    characters: (
      <CharactersPage
        t={t}
        profile={profile}
        onSaveProfile={handleSaveProfile}
        lang={lang}
        authUser={authUser}
        onRequestAuth={() => setShowAuth(true)}
      />
    ),
    campaigns: <CampaignsPage t={t} lang={lang} />,
    clans: (
      <ClansPage
        lang={lang}
        authUser={authUser}
        onRequestAuth={() => setShowAuth(true)}
        initialClanId={route.id}
      />
    ),
    user: (
      <UserProfilePage
        login={route.id}
        lang={lang}
        authUser={authUser}
        onRequestAuth={() => setShowAuth(true)}
        onBack={backFromUser}
      />
    ),
    news: <NewsPage t={t} lang={lang} onOpenNews={openNewsItem} />,
    profile: (
      <ProfilePage
        profile={profile}
        onSaveProfile={handleSaveProfile}
        saveError={profileError}
        t={t}
        authUser={authUser}
        onRequestAuth={() => setShowAuth(true)}
        lang={lang}
        onOpenArticle={openArticle}
        onOpenNews={openNewsItem}
      />
    ),
    articles: (
      <ArticlesPage
        t={t}
        lang={lang}
        authUser={authUser}
        onRequestAuth={() => setShowAuth(true)}
        onOpenArticle={openArticle}
        onCreate={() => setEditorArticle({})}
      />
    ),
    article: (
      <ArticlePage
        id={route.id}
        lang={lang}
        authUser={authUser}
        onRequestAuth={() => setShowAuth(true)}
        onBack={() => setActiveTab('articles')}
        onEdit={setEditorArticle}
      />
    ),
    'news-item': (
      <NewsItemPage
        id={route.id}
        lang={lang}
        authUser={authUser}
        onRequestAuth={() => setShowAuth(true)}
        onBack={() => setActiveTab('news')}
      />
    ),
    admin: (
      <AdminNewsPage lang={lang} authUser={authUser} onRequestAuth={() => setShowAuth(true)} />
    ),
  }

  return (
    <div className={`app-root lang-${lang}`} data-lang={lang}>
      <Navbar
        lang={lang}
        setLang={setLang}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        t={t}
        authUser={authUser}
        onRequestAuth={() => setShowAuth(true)}
        onLogout={logout}
      />

      <main key={`${activeTab}:${route.id ?? ''}`} className="page-enter">
        {pages[activeTab] || pages.home}
      </main>
      <Footer setActiveTab={setActiveTab} t={t} />

      {authOverlay.isMounted && (
        <AuthModal
          lang={lang}
          isEntered={authOverlay.isEntered}
          initialError={externalAuthError}
          onClose={() => {
            setExternalAuthError('')
            setShowAuth(false)
          }}
          onSuccess={acceptUser}
        />
      )}

      <ThemeCursor cursor={profile?.cursor} />
      <Wanderers
        lang={lang}
        showWanderers={profile?.showWanderers !== false}
        showDragon={profile?.showDragon !== false}
      />

      {editorOverlay.isMounted && (
        <ArticleEditor
          lang={lang}
          authUser={authUser}
          isEntered={editorOverlay.isEntered}
          initial={editorOverlay.value?.id ? editorOverlay.value : null}
          onClose={() => setEditorArticle(null)}
          onSaved={saved => {
            setEditorArticle(null)

            if (saved?.id) openArticle(saved.id)
          }}
        />
      )}
    </div>
  )
}

export default App
