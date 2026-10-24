# nado

> Tell nado what you like and when you're free. Claude opens a room on its own and invites the people who can join, so nobody ever has to ask first.

**na·do** · */ˈnɑː.doʊ/* · **나도** means ***"me too"*** in Korean, and ***do*** means let's actually do it.

Built at **Cal Hacks 13.0** (October 2026) by four Korean exchange students.

- **Demo video:** _coming soon_
- **Live app:** _coming soon_

---

## Table of Contents

- [What Does "nado" Mean?](#what-does-nado-mean)
- [The Problem](#the-problem)
- [Our Solution](#our-solution)
- [How It Works](#how-it-works)
- [How We Use Claude](#how-we-use-claude)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Demo](#demo)
- [Safety and Privacy](#safety-and-privacy)
- [Roadmap](#roadmap)
- [Team](#team)
- [Acknowledgments](#acknowledgments)

---

## What Does "nado" Mean?

One word, read three ways:

| Read it as | Meaning |
|---|---|
| **나도** (nado) | Korean for *"me too!"* What you say when a friend mentions something you want to do as well. |
| **나 + do** | **나** (na) means *"I / me"* in Korean. Next to the English *do*, it becomes *"I'll do it."* |
| **do** | Not "maybe later." Not "let's plan something." Let's actually do it, right now. |

And when friends text, 나도 softens into **나두** (nadu), the playful spelling. *"나두나두!"* means *"Me too, me too!"*

When a friend says *"I'm craving boba,"* the easiest reply in the world is *"나도!"* You don't plan anything, lead anything, or ask first. You just say yes.

That one word is exactly what we kept missing as exchange students: things we wanted to do, and no one around to say *nado*. So we built the place where someone always can.

> Claude says *"Boba at 3, anyone?"* → you say **"나도!"** → you meet.

---

## The Problem

**"I want to do something right now, but I have no one to do it with."**

As exchange students, we all lived this. You want to play basketball, but your friends are busy. You want to see a musical, but no one shares the interest. You have a free hour and want someone to grab boba with.

It's not that nobody wants to join. The people who would say *"나도!"* (me too!) never see an invitation, because someone has to send it first.

And almost nobody wants to be that someone. Asking first, picking a place, the awkward wait if no one shows up, breaking the ice. For shy students far from home, that pressure is often enough to just stay in.

## Our Solution

**nado** removes the person who has to ask first. **Claude is the host.**

- **You never post an invitation.** You just tell nado what you like and when you're free.
- **Claude opens rooms on its own.** When two or more students share an interest and a free time slot, Claude creates a room and invites them.
- **Joining is one tap.** You see an invitation that is already happening. You just say *"nado!"*
- **Claude handles the awkward parts.** It picks the place, confirms the meetup, and gives everyone an easy first question.

## How It Works

| Step | What happens |
|---|---|
| **1. Tell nado about you** | Write it like you'd tell a friend: *"I love boba and pickup basketball, free most afternoons."* Claude turns it into interest keywords. Then tap the time slots you're free this week. |
| **2. Claude opens a room** | Claude finds students whose interests and free times overlap, and opens a room on its own: *"Boba · Today 3:00 PM · Student Union · 3 students free"*. |
| **3. Say "nado!"** | Those students get a notification and join with one tap, the app version of texting back *"나두!"* Nobody posted it, so nobody is the organizer. |
| **4. Meet up** | Once at least two join, Claude confirms. Everyone's screen turns the same color, with the meeting spot and an icebreaker question. |

**Color Match example**

> 🟠 Meet at the Student Union lobby at 3:00 PM. Look for someone holding an orange screen!
>
> Icebreaker: *You both love boba. What's your go-to order?*

No phone numbers to swap, no profile photos to search through.

## How We Use Claude

Claude plays two roles: it **understands** each student, and it **hosts** the meetup.

| Role | Capability | Example |
|---|---|---|
| Understand | Interests from natural language | "boba and pickup basketball" → `["boba", "basketball"]` |
| Understand | Related activities | Knows "boba" and "bubble tea" are the same thing |
| Understand | Safety filtering | Ignores discriminatory preferences such as "Koreans only" |
| Host | Opening rooms | Spots shared interests and free times, then opens a room with an activity, time, and place |
| Host | Invitation | Writes the invitation in nado's name and sends it to students who are free |
| Host | Icebreaker | Writes one easy first question from what the group has in common |

Students can review and edit the keywords Claude pulled from their description.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend and API | [Next.js](https://nextjs.org) |
| Database and real-time | [Supabase](https://supabase.com) |
| AI | [Claude API](https://docs.claude.com) (Anthropic) |
| Hosting | [Vercel](https://vercel.com) |

## Architecture

```
 Students' interests + free times
              │
              ▼
 ┌──────────────────┐   "who overlaps?"   ┌────────────┐
 │   Next.js app    │ ──────────────────▶ │ Claude API │  opens a room:
 │    (Vercel)      │ ◀────────────────── └────────────┘  activity, time, place,
 └──────────────────┘                                      invitation, icebreaker
              │ save room
              ▼
 ┌──────────────────┐  real-time   ┌──────────┐   ┌──────────┐
 │     Supabase     │ ───────────▶ │ Phone A  │   │ Phone B  │
 │  DB + Realtime   │ ───────────────────────────▶│ "nado!"  │
 └──────────────────┘              └──────────┘   └──────────┘
```

## Getting Started

> Setup steps will be finalized as we build.

1. Clone the repository
   ```bash
   git clone https://github.com/dasol0312/nado.git
   cd nado
   ```
2. Install dependencies
   ```bash
   npm install
   ```
3. Create `.env.local` with your keys (never commit this file)
   ```
   ANTHROPIC_API_KEY=your_key
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```
4. Run the app
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000 and pick a demo user to sign in as.

## Demo

The demo simulates an active campus with **20 to 30 sample students**, each with interests and free times, plus two real phones.

1. A judge describes themselves in one sentence, and Claude turns it into interest keywords.
2. We tap **"Let Claude open rooms"** (the demo's stand-in for Claude checking on a schedule).
3. Claude opens a room that fits the judge, for example *"Boba · 3:00 PM · Student Union"*.
4. The judge's phone and a teammate's phone both get the invitation. Both tap **nado!**
5. Claude confirms. Both phones show the same color, the meeting spot, and an icebreaker.

**What's simulated:** sample students, their free times, and the list of meeting spots are seeded for the demo. In the real app Claude would check for rooms on a schedule instead of on a button press. There is no live campus user base yet.

## Safety and Privacy

- University email verification *(planned; the demo uses sample students)*
- Minimal personal information before matching
- Public meeting locations only
- Students choose whether to join, every time
- Discriminatory preferences are ignored

## Roadmap

**Hackathon MVP**
- Interests in natural language + free-time slots
- Claude opens rooms and invites students who are free
- One-tap join and the Color Match screen with an icebreaker

**Next**
- Claude checks for rooms automatically on a schedule
- Related-activity suggestions when an exact match is missing
- Reminders, and finding a replacement if someone drops out
- Private meetup feedback and personal blocking
- University email verification

## Team

We're four Korean exchange students who kept wishing someone nearby would say *"나도!"*

| Name | Role |
|---|---|
| _name_ | _role_ |
| _name_ | _role_ |
| _name_ | _role_ |
| _name_ | _role_ |

## Acknowledgments

- Built at **Cal Hacks 13.0**, San Francisco, October 2026
- AI tools: Claude API, and Claude Code for development
- Planning guided by [calhacks-kit](https://github.com/georgeykalangi/calhacks-kit)

---

*Nobody has to ask first. Claude is the host. You just say* **"나도!" — nado. Me too.**
