import aboutHero from '../assets/about_hero.jpg'
import Wordmark from '../components/Wordmark'
import { useReveal } from '../hooks/useReveal'

function HomePage({ t }) {
  const about = useReveal()

  const cta = useReveal(undefined, { lead: 40 })

  return (
    <>
      <section className="hero" data-od-id="home-hero">
        <div className="hero-content">
          <h1 className="wordmark">
            <Wordmark text={t.heroTitle} />
          </h1>
          <p>{t.heroDesc}</p>
          <button className="btn btn-action btn-lg">{t.seeMore}</button>
        </div>
      </section>

      <section className="about-section" data-od-id="home-about">
        <div className="about-container" ref={about}>
          <div
            className="about-image reveal"
            style={{ backgroundImage: `url(${aboutHero})` }}
          ></div>
          <div className="about-text reveal">
            <h2>{t.aboutTitle}</h2>
            <p>{t.aboutDesc}</p>
          </div>
        </div>
      </section>

      <section className="cta-section" data-od-id="home-cta" ref={cta}>
        <h2 className="reveal">{t.ctaTitle}</h2>
        <p className="reveal">{t.ctaDesc}</p>

        <span className="reveal cta-btn-wrap">
          <button className="btn btn-action">{t.ctaBtn}</button>
        </span>
      </section>
    </>
  )
}

export default HomePage
