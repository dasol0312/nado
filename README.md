# nado

> Pick what you want to do and paint the hours you're free. Claude opens a room on its own and invites the people who can join, so nobody ever has to ask first.

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

- **You never post an invitation.** You just pick activities and drag over the hours you're free, like When2meet.
- **Claude opens rooms on its own.** When two or more students want the same activity at overlapping times, Claude creates a room and invites them.
- **Joining is one tap.** You see an invitation that is already happening. You just say *"nado!"* and you're in the group chat.
- **Claude handles the awkward parts.** It picks the place, opens the chat with the plan, and gives everyone an easy first question.

## How It Works

| Step | What happens |
|---|---|
| **1. Pick and paint** | Pick an activity (boba, basketball, or type your own), then drag over a weekly grid to paint when you want to do it, like When2meet. *Basketball: Mon and Wed, 9 to 11 PM.* Repeat for each activity. |
| **2. Claude opens a room** | Claude finds students who want the same activity at overlapping times, and opens a room on its own: *"Boba · Sunday 3:00 PM · Boba Corner · 4 students free"*. |
| **3. Say "nado!"** | Those students get a notification and join with one tap, the app version of texting back *"나두!"* Saying nado puts you in the room's group chat. Nobody posted it, so nobody is the organizer. |
| **4. Meet up** | Claude starts the chat with the time, the place, and an icebreaker. At meetup time, everyone's screen turns the same color so you can find each other. |

Your times repeat every week, so you set them once and keep getting invitations.

**Color Match example**

> 🟠 Meet at the Student Union lobby at 3:00 PM. Look for someone holding an orange screen!
>
> Icebreaker: *You both love boba. What's your go-to order?*

No phone numbers to swap, no profile photos to search through. Just an activity, a time, and people who said *nado* too.

## How We Use Claude

Claude plays two roles: it **understands** what students want, and it **hosts** the meetup.

| Role | Capability | Example |
|---|---|---|
| Understand | Related activities | Puts "bubble tea" with "boba" and "pickup basketball" with "basketball", which exact matching would miss |
| Understand | Safety filtering | Drops discriminatory conditions from custom activities, such as "boba, Koreans only" → "boba" |
| Host | Opening rooms | Spots shared activities and overlapping times, then opens a room with an activity, time, and place |
| Host | Invitation | Writes the invitation in nado's name and sends it to students who are free |
| Host | Icebreaker | Posts the first message in the group chat: the plan plus one easy question from what the group has in common |

Claude only ever sees activities and time slots. It never ranks or judges people.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend and API | [Next.js](https://nextjs.org) |
| Database and real-time | [Supabase](https://supabase.com) |
| AI | [Claude API](https://docs.claude.com) (Anthropic) |
| Hosting | [Vercel](https://vercel.com) |

## Architecture

```
 Students' activities + weekly time grid
              │
              ▼
 ┌──────────────────┐   "who overlaps?"   ┌────────────┐
 │   Next.js app    │ ──────────────────▶ │ Claude API │  opens a room:
 │    (Vercel)      │ ◀────────────────── └────────────┘  activity, time, place,
 └──────────────────┘                                      invitation, icebreaker
              │ save room, invitations, chat
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
3. Set up Supabase
   - **Using the team's Supabase project:** it's already set up. Skip this step and don't run the SQL files: they delete all existing data.
   - **Using your own new, empty project:** in the SQL Editor, run `supabase/schema.sql`, then `supabase/seed.sql` for sample data.
4. Create `.env.local` with your keys (never commit this file)
   ```
   ANTHROPIC_API_KEY=your_key
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ANTHROPIC_WORKSPACE_ID=your_workspace_id
   ```
5. Run the app
   ```bash
   npm run dev
   ```
6. Open http://localhost:3000 and pick a demo user to sign in as.

## Demo

The demo simulates an active campus with **24 sample students**, each with activities and weekly time slots, plus two real phones.

1. A judge picks **boba** and paints Sunday afternoon on the time grid.
2. We tap **"Let Claude open rooms"** (the demo's stand-in for Claude checking on a schedule).
3. Claude opens a room that fits the judge, for example *"Boba · Today 1:00 PM · Boba Corner"*. One sample student typed "bubble tea" instead of "boba", and Claude still puts them in the same room.
4. The judge's phone and a teammate's phone both get the invitation. Both tap **nado!**
5. Both land in the group chat, where Claude has posted the plan and an icebreaker. At meetup time, both phones show the same color.

**What's simulated:** sample students, their weekly times, and the list of meeting spots are seeded for the demo. In the real app Claude would check for rooms on a schedule instead of on a button press. There is no live campus user base yet.

## Safety and Privacy

- University email verification *(planned; the demo uses sample students)*
- Minimal personal information before matching
- Public meeting locations only
- Students choose whether to join, every time, and the group chat opens only after you say *nado*
- Discriminatory preferences are ignored

## Roadmap

**Hackathon MVP**
- Activity picker + weekly drag-to-paint time grid
- Claude opens rooms and invites students who are free
- One-tap join, group chat with Claude's first message, and the Color Match screen

**Next**
- Claude checks for rooms automatically on a schedule
- Type one sentence ("basketball Mon/Wed nights") and Claude pre-paints your grid
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
