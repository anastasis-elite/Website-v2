import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const events = []
const captures = []
const linkProps = []
const cache = new Map()
const Link = ({ href, children, ...props }) => { linkProps.push({ href, children, ...props });return React.createElement('a', { href, ...props }, children) }
function load(path) {
  path = resolve(path)
  if (cache.has(path)) return cache.get(path).exports
  const module = { exports: {} };cache.set(path, module)
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(source, { module, exports: module.exports, process: { env: { NEXT_PUBLIC_APP_URL: 'https://anastasiselite.com' } }, require(name) {
    if (name === 'next/link') return { __esModule: true, default: Link }
    if (name === '@/components/TrackEvent') return { __esModule: true, default: props => { events.push(JSON.parse(JSON.stringify(props)));return null } }
    if (name === '@/lib/analytics') return { trackEvent(event, properties) { captures.push(JSON.parse(JSON.stringify({ event, properties }))) } }
    if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    if (name.startsWith('@/') || name.startsWith('.')) {
      const stem = name.startsWith('@/') ? resolve(name.slice(2)) : resolve(dirname(path), name)
      for (const suffix of ['.tsx', '.ts', '']) {
        try { readFileSync(stem + suffix);return load(stem + suffix) } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error }
      }
      throw new Error(`Unresolved local public page dependency: ${name}`)
    }
    return require(name)
  } }, { filename: path })
  return module.exports
}

const decode = value => value.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
const normalize = value => decode(value).replace(/\s+/g, ' ').trim()
const visible = html => normalize(html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1]
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' '))
const expected = copy => normalize(copy.replace(/^\* /gm, '').replace(/\[([^\]]+)\]/g, '$1'))
const links = html => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, content]) => ({
  href: decode(attributes.match(/\bhref="([^"]+)"/)[1]), label: normalize(content.replace(/<[^>]+>/g, ' ')),
}))
const aboutCopy = `What is Anastasis?

A more considered way to care for yourself.

You can remember everyone’s appointments, keep work moving, and know what the house needs before anyone asks.

Yet finding a moment for your own health can mean making another list of decisions.

Which workout should I do? Am I eating enough? Should I push through today, or rest?

Anastasis brings your workouts, nutrition, recovery, and progress into one place—with personal guidance that helps you know where to begin and what to focus on.

So more of the time you make for yourself can actually be spent taking care of yourself.

You want to feel like yourself again.

Strong when you lift. Comfortable in your clothes. More energy for the life you’re building—and something left for yourself at the end of it.

You may already be making an effort. Saving workouts. Trying to eat well. Getting back into a routine whenever the week allows.

But fitting those pieces together takes time and attention, too.

Anastasis helps ease that planning and guesswork, with a clearer path toward your goals.

Support that considers the woman living the day.

Your goals matter. So do your training experience, available equipment, and the time you have.

Your check-ins add context about how you’re feeling, helping inform the guidance you receive.

Because a plan should be useful on an ordinary Tuesday, with everything else you have going on.

What that looks like for you.

Walk into your workout knowing where to start.
A personal training plan gives you exercises, sets, and repetitions, with a place to record your work.

Give your nutrition a clearer direction.
Keep your nutrition and water targets together, with additional food tools available as your level of support grows.

Make room for recovery.
Bring how you’re feeling into the picture, with guidance that helps you consider when rest or a gentler day may be useful.

See the progress you might otherwise miss.
Return to your workouts, measurements, and progress records to see what has changed beyond how you feel in a single moment.

The depth of guidance and tools available depends on your chosen program.

You deserve support, too.

Created by Rhea Nyx Anastasia, Certified Personal Trainer and Certified Nutrition Coach, Anastasis brings together the pieces women are so often left to manage on their own.

A place to begin. Guidance to return to. Room to keep going as life changes.

You carry enough. Your health shouldn’t be one more thing you have to figure out.

Find your starting point with five brief questions.

[Find My Starting Point]`

const programsCopy = `Find the support that feels right for you.

Some mornings, you have time for yourself before the house wakes up. Others, you’re answering messages while looking for someone’s shoes.

You still want to feel strong. Eat well. Feel comfortable in your body. Have energy for something beyond getting through the day.

Anastasis gives those goals a place in the life you’re already living.

Choose from three levels of support, each bringing your training, nutrition, recovery, and progress together—with different amounts of detail and daily direction.

[Explore the Programs]
[Help Me Choose]

What would make taking care of yourself feel easier?

EMBER

A clear plan to come back to.

You’ve saved the workouts. You’ve started on Mondays. You know how good it feels when you find your rhythm.

Then the week gets full, and deciding where to begin again becomes its own task.

Ember gives you a foundation you can return to: your training plan, nutrition and water targets, and basic recovery guidance, together in one place.

When you make time for yourself, you have somewhere to start.

Your support includes:

* Training shaped by your starting assessments.
* Nutrition targets and a simple place to enter daily totals.
* Water tracking.
* Basic recovery guidance.
* Progress records, foundational assessments, and cycle context.

For you if: You want a clear structure and feel comfortable managing the day-to-day details yourself.

[Explore Ember]

IGNITE

More understanding behind your effort.

You’re making time for your health. But some days, you finish a workout or look back over what you’ve eaten and still wonder what needs your attention.

You’d like more than a record of what you did. You want a clearer picture.

Ignite builds on the foundation with food logging, more nutrition detail, and additional recovery recommendations. It brings those details alongside your training so they’re easier to consider together.

A place to look more closely, without keeping everything in your head.

Your support includes everything in Ember, plus:

* Food logging, including barcode scanning.
* Nutrient details from the foods you record.
* Additional recovery recommendations.
* Progress photo uploads.
* Posture tools with landmarks you review and confirm.

For you if: You like understanding the details and want more information to help guide your choices.

[Explore Ignite]

PHOENIX

Less figuring out. A clearer next step.

By the time you get a moment to yourself, you’ve already made decisions for work, the household, and everyone who needed something.

Even a good plan can feel like more to sort through.

Phoenix offers our most directed experience, bringing meal recommendations and suggested nutrition and recovery actions into your daily view.

So when you open Anastasis, there’s guidance to help you decide what deserves your attention next.

Your support includes everything in Ignite, plus:

* Meal recommendations.
* More direct guidance on your next nutrition and recovery steps.
* Suggestions informed by the information you share.

For you if: You want more help deciding what to do next and less time spent working through the details.

[Explore Phoenix]

Begin with the support you need today.

You don’t have to build a perfect routine before you belong here.

You can arrive with a full calendar, an interrupted week, and goals that still matter to you.

Tell us a little about your time, energy, and the support you’re looking for. Five brief questions will suggest a program for you to explore.

[Find My Starting Point]

About 1–2 minutes. Space to consider what feels right.`

const founderCopy = `Built from a life that needed it.

The story behind Anastasis.

Anastasis began with questions from my own life.

I’m a mother of four, a personal trainer, and a nutrition coach. I know what it feels like to care deeply about your health while having a day already full of people and responsibilities that need your attention.

I also know the effort that happens before a workout ever begins.

Finding the time. Choosing what to do. Working out what to eat. Trying to understand why something felt manageable last week and feels exhausting today.

You can want to take care of yourself and still struggle to find room for all the decisions that come with it.

That became the starting point for Anastasis.

First, I wanted to understand.

My own training gave me reasons to look more closely.

How I moved. Where I felt discomfort. What changed as I became stronger. How sleep, stress, and recovery affected what I could bring to a workout.

Becoming a certified personal trainer and nutrition coach gave me a foundation to investigate those questions more thoughtfully. Working with women made the picture bigger.

A program could look carefully planned and still be difficult to use in someone’s actual life.

The exercises were only part of the experience. There was also the interrupted night, the workday that ran over, the family responsibilities, and the energy it took to make another decision.

I wanted those things to have a place in the plan.

The idea grew beyond the workout.

The more I considered what useful support would look like, the more connected it became.

Training belonged alongside nutrition. Recovery needed a place in the day. Progress needed to be easier to see than trying to remember how things felt a month ago.

And all of it needed to make sense to the woman opening it.

That became Anastasis: a place to bring those pieces together, with guidance that helps make caring for yourself more manageable.

The purpose has stayed the same as the idea has grown:

You carry enough. Your health shouldn’t be one more thing you have to figure out.

Behind the scenes, it’s built in the details.

Building Anastasis happens alongside the life that inspired it.

Between motherhood, coaching, my own training, and the everyday work of keeping a household moving, I’m shaping the experience one decision at a time.

Some days, that means working through how a training plan should be presented. Other days, it means testing a photo upload, reconsidering a check-in, or opening the same screen on my phone, tablet, and computer to see how it actually feels to use.

There are small questions behind those decisions.

Can she see where to begin?

Can she record a little progress when she hasn’t finished everything?

If her afternoon changes, can she find her way back without feeling lost?

Those details matter because they’re the moments when a thoughtful idea becomes useful support.

Built with ambition. Refined through real use.

Anastasis is still growing.

I’m testing, listening, and refining how the pieces work together. Some parts of the wider vision are still ahead, and I want to be clear about what is available as each part takes shape.

The standard I keep returning to is simple: does this make caring for herself easier to understand and easier to fit into her life?

That question guides what I build next.

A place for the woman with a life already in motion.

I’m building Anastasis for the woman who has goals of her own alongside everything she does for others.

The woman who wants to feel stronger, feel more at home in her body, and make progress without spending every spare moment researching how.

I want her to open Anastasis and feel that her life was considered.

Because it was.

Rhea Nyx Anastasia
Founder · Certified Personal Trainer · Certified Nutrition Coach

[Find Your Starting Point]`

test('What is Anastasis renders the exact approved editorial copy and starting-point destination', () => {
  const page = load('app/what-is-anastasis/page.tsx')
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.equal(visible(html), expected(aboutCopy))
  assert.deepEqual(links(html), [{ label: 'Find My Starting Point', href: '/audit' }])
  assert.equal((html.match(/<h1\b/g) || []).length, 1)
  assert.doesNotMatch(html, /<img\b|<video\b|<canvas\b|href="\/api\/checkout|href="\/programs/)
})

test('Programs renders exact tier copy and existing detail/audit routes with a real in-page programs target', () => {
  const page = load('app/program/page.tsx')
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.equal(visible(html), expected(programsCopy))
  assert.deepEqual(links(html), [
    { label: 'Explore the Programs', href: '#programs' }, { label: 'Help Me Choose', href: '/audit' },
    { label: 'Explore Ember', href: '/program/ember' }, { label: 'Explore Ignite', href: '/program/ignite' },
    { label: 'Explore Phoenix', href: '/program/phoenix' }, { label: 'Find My Starting Point', href: '/audit' },
  ])
  assert.match(html, /\bid="programs"/)
  assert.equal((html.match(/<h1\b/g) || []).length, 1)
  assert.equal((html.match(/<li\b/g) || []).length, 13)
  assert.doesNotMatch(html, /<img\b|<video\b|<canvas\b|href="\/api\/checkout|href="\/programs/)
})

test('About Anastasis renders the exact founder story and preserves the existing audit CTA capture', () => {
  linkProps.length = 0;captures.length = 0
  const page = load('app/about/page.tsx')
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.equal(visible(html), expected(founderCopy))
  assert.deepEqual(links(html), [{ label: 'Find Your Starting Point', href: '/audit' }])
  assert.equal((html.match(/<h1\b/g) || []).length, 1)
  assert.doesNotMatch(html, /href="\/api\/checkout|href="\/programs/)
  const cta = linkProps.find(link => link.href === '/audit')
  assert.equal(typeof cta.onClick, 'function')
  cta.onClick()
  assert.deepEqual(captures, [{ event: 'audit_cta_clicked_about', properties: { location: 'final_cta', page: 'about' } }])
})

test('public metadata, founder structured data and existing page-view events retain their correct page identity', () => {
  events.length = 0
  for (const [path, canonical, event, pageName] of [
    ['app/what-is-anastasis/page.tsx', '/what-is-anastasis', 'what_is_anastasis_page_viewed', 'what-is-anastasis'],
    ['app/program/page.tsx', '/program', 'program_page_viewed', 'programs'],
    ['app/about/page.tsx', '/about', 'about_page_viewed', 'about'],
  ]) {
    const page = load(path), metadata = page.metadata
    const html = renderToStaticMarkup(React.createElement(page.default))
    assert.equal(metadata.alternates.canonical, canonical)
    assert.equal(metadata.openGraph.url, canonical)
    assert.equal(metadata.openGraph.siteName, 'Anastasis')
    assert.equal(metadata.twitter.card, 'summary')
    assert.ok(metadata.description.length > 40)
    assert.doesNotMatch(JSON.stringify(metadata), /Founder-Led Human Engineering|AI-powered|guarantee|medical/i)
    assert.deepEqual(events.at(-1), { event, properties: { page: pageName } })
    if (canonical === '/what-is-anastasis') {
      const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
      const graph = jsonLd['@graph'] || [jsonLd]
      const about = graph.find(item => item['@type'] === 'AboutPage')
      assert.equal(about.url, 'https://anastasiselite.com/what-is-anastasis')
      const founder = graph.find(item => item['@type'] === 'Person')
      assert.equal(founder.name, 'Rhea Nyx Anastasia')
      assert.deepEqual(founder.hasCredential.map(item => item.credentialCategory), ['Certified Personal Trainer', 'Certified Nutrition Coach'])
    }
  }
})

test('editorial brand styling is page-scoped, responsive and readable without a reveal dependency or new assets', () => {
  const css = readFileSync('app/styles/publicEditorial.module.css', 'utf8')
  assert.match(css, /1020px/)
  assert.match(css, /#c58b57/i)
  assert.match(css, /#f5f0e8/i)
  assert.match(css, /--landing-section-title/)
  assert.match(css, /--landing-body/)
  assert.match(css, /line-height:\s*1\.9/)
  assert.match(css, /letter-spacing:\s*6px/)
  assert.match(css, /@media\s*\(max-width:\s*760px\)/)
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  assert.doesNotMatch(css, /:root|:global|\.dashboard-client-shell|\.client-dashboard-nav|url\(|animation:/)
  for (const path of ['app/what-is-anastasis/page.tsx', 'app/program/page.tsx', 'app/about/page.tsx']) {
    const source = readFileSync(path, 'utf8')
    assert.match(source, /@\/components\/(?:Button|TrackedButton)/)
    assert.doesNotMatch(source, /homepage\.module|HomepageAnalytics|MistReveal|\/api\/pricing|\/api\/checkout|commerce\/catalog|price_[A-Za-z0-9]/)
  }
})
