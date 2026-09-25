import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import './styles/shell.css'
import './styles/home.css'
import './styles/rules.css'
import './styles/campaigns.css'
import './styles/news.css'
import './styles/profile.css'
import './styles/modals.css'
import './styles/articles.css'
import './styles/shared-content.css'
import './styles/characters.css'
import './styles/designer-layout.css'
import './styles/dnd-theme.css'
import './styles/article-view.css'
import './styles/comments.css'
import './styles/editor.css'
import './styles/admin-news.css'
import './styles/news-interactions.css'
import './styles/article-extras.css'
import './styles/async-states.css'
import './styles/admin-users.css'
import './styles/profile-controls.css'
import './styles/cursor.css'
import './styles/wanderers.css'
import './styles/clans.css'
import './styles/user-profile.css'

import './styles/controls.css'
import './styles/motion.css'

import './styles/responsive.css'
import App from './App.jsx'
import AuthProvider from './auth/AuthProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
