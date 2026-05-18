'use client'

import { useMemo } from 'react'

const quotes = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { text: "Great things never come from comfort zones.", author: "Unknown" },
  { text: "Dream it. Wish it. Do it.", author: "Unknown" },
  { text: "Success doesn't just find you. You have to go out and get it.", author: "Unknown" },
  { text: "The key to success is to focus on goals, not obstacles.", author: "Unknown" },
  { text: "Dream bigger. Do bigger.", author: "Unknown" },
  { text: "Little things make big days.", author: "Unknown" },
  { text: "It's going to be hard, but hard does not mean impossible.", author: "Unknown" },
  { text: "Don't stop when you're tired. Stop when you're done.", author: "Unknown" },
  { text: "Wake up with determination. Go to bed with satisfaction.", author: "Unknown" },
  { text: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
  { text: "Sometimes we're tested not to show our weaknesses, but to discover our strengths.", author: "Unknown" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
]

export default function MotivationalQuote() {
  const quote = useMemo(() => {
    return quotes[Math.floor(Math.random() * quotes.length)]
  }, [])

  return (
    <section>
      <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3">
        Daily spark
      </p>
      <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
        <p className="text-sm leading-relaxed text-foreground">
          &ldquo;{quote.text}&rdquo;
        </p>
        {quote.author !== 'Unknown' && (
          <p className="mt-2 text-[11px] text-muted-foreground">— {quote.author}</p>
        )}
      </div>
    </section>
  )
}
