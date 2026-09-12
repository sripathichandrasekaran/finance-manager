/*
 * Freelancer Message Kit — premium, copy-paste messages for every business
 * situation, auto-filled with live client data from the app (name, amount
 * paid, days since last invoice, invoice count).
 *
 * Tokens: {name} {industry} {amount} {days} {lastDate} {invoices}
 * Optional segments: wrap in {{ ... }} — dropped entirely when the data is
 * missing (e.g. a client you have never invoiced).
 */

export const MESSAGE_CATEGORIES = [
  "Win back",
  "Money",
  "Payments",
  "Proof",
  "Kickoff",
  "Rates",
  "Upsell",
  "Closeout",
];

export const MESSAGE_SCENARIOS = [
  {
    id: "winback",
    category: "Win back",
    title: "The gentle hello",
    when: "Client hasn't ordered in 90+ days. Short, no pitch — availability only.",
    tone: "Friendly, low-pressure",
    template:
      `Hi {name},

{{It's been {days} days since our last project.}} Hope things have been going well on your end. I've still got all the work we did together on file, so picking back up takes zero re-introduction.

I have some open capacity this month and your kind of work (web, {industry}) is exactly what I've been doing. Anything that needs a refresh, a fix, or a new build — just reply and I'll hold a slot for you.

— Sripathi`,
  },
  {
    id: "deposit",
    category: "Money",
    title: "Request an advance",
    when: "Before starting new work. Standard safety for freelance deals.",
    tone: "Confident, fair",
    template:
      `Hi {name},

Excited to get started on this! Here's how I run things so the timeline stays smooth:

• 40% advance to book the slot and start
• 40% on design/content approval
• 20% on delivery, before handover

{{Amounts adjust to the project size — for transparency, our previous work together totalled {amount} across {invoices} invoices, all settled cleanly.}}

If the advance structure works for you, share the deposit and I'll begin today. Happy to jump on a quick call if you'd like to talk it through.

— Sripathi`,
  },
  {
    id: "negotiate",
    category: "Money",
    title: "Stand by your rate",
    when: "A lead tries to push your price down. Wraps value around the number.",
    tone: "Polished, non-apologetic",
    template:
      `Hi {name},

I completely get wanting to keep costs down. To be straight with you: my work is a flat ₹ figure with no hidden charges, and the price reflects the care that goes in — as well as the fact that I finish on time, reply fast, and stick around after launch if anything breaks.

What I can do to bring the number down without cutting corners:
• Trim scope (I'll list exactly what drops out)
• A tighter timeline that lowers my hours spent

If either works, tell me which and I'll send the adjusted quote today. If not, no hard feelings at all.

— Sripathi`,
  },
  {
    id: "kickoff",
    category: "Kickoff",
    title: "What I need from you",
    when: "Right after a 'go' — removes every excuse for delay by asking for the inputs up front.",
    tone: "Organised, pro",
    template:
      `Hi {name},

Locked in. To hit the timeline I promised, here's what I need from your side (asap, in one reply):

1. Logins/access to what we're working with
2. Content, images and text (or 'you handle it' and I'll draft)
3. A contact who can approve designs within 24h
4. One example or reference you like, if any

That's it. The moment those land, work starts and I'll send a quick progress update every couple of days so you always know where things stand.

— Sripathi`,
  },
  {
    id: "payment",
    category: "Payments",
    title: "Gentle payment nudge",
    when: "An invoice is overdue. Polite, no accusations — easy to pay.",
    tone: "Warm, matter-of-fact",
    template:
      `Hi {name},

Quick one — just checking the invoice I sent ({lastDate}{{, invoice {invoices}}}) reached you. If everything's fine on your side, a quick payment keeps our account nice and tidy and lets me keep the next round of work moving.

Here's the link again if useful. Happy to split it into two parts if that makes it easier.

Thanks for the great working relationship!

— Sripathi`,
  },
  {
    id: "testimonial",
    category: "Proof",
    title: "Ask for a review",
    when: "Shortly after delivery/payment. Strike while the project is fresh.",
    tone: "Grateful, direct",
    template:
      `Hi {name},

Thank you — really glad we got the work over the line.

If you were happy with the result, a 2–3 line review would mean the world to me — it's genuinely how freelancers win their next client. Feel free to say less if you're stretched for time.

And if there's a next project on the horizon, you're always first in the queue.

— Sripathi`,
  },
  {
    id: "referral",
    category: "Proof",
    title: "Ask for referrals",
    when: "A happy client, 1–2 weeks after launch.",
    tone: "Friendly, appreciative",
    template:
      `Hi {name},

Everything stable since launch? That's the goal.

Quick ask: do you know one or two people — founders, agencies, business owners — who could use this kind of work? A one-line intro is all it takes, and I'll bring the same care to them that I brought to you.

Their privacy's safe: I'll only reach out if you say it's OK.

— Sripathi`,
  },
  {
    id: "rateincrease",
    category: "Rates",
    title: "Rate increase letter",
    when: "Annual or milestone-based pricing update for returning clients.",
    tone: "Straightforward, appreciative",
    template:
      `Hi {name},

Hope you're doing well. I'm writing early to let you know that from next month my rates go up — a long-overdue adjustment as my work has gotten sharper and faster, not the other way around.

Nothing changes for what's currently in progress; this applies to new work after the date.

If you have something coming up, starting before the change means locking in the current rate. Either way, thank you for the trust you've placed in me — it hasn't gone unnoticed.

— Sripathi`,
  },
  {
    id: "scopecreep",
    category: "Closeout",
    title: "Scope change, politely",
    when: "A regular client keeps adding requests outside the agreed scope.",
    tone: "Fair, transparent",
    template:
      `Hi {name},

Loving that the project's growing — good sign!

Just to keep everything above board: a couple of the recent asks go beyond the agreed scope. Totally fine to include them, but I'd like to price them before I build, so you can decide what's worth it.

I'll line up options (item + price) and you pick what you want — then we carry on as usual. Keeps surprises out of the invoice.

— Sripathi`,
  },
];