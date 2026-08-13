A POS system should be designed around the real workflow of the person using it—not around what looks modern or what is common in web/mobile apps.

The first article shows this through a real Swiss POS redesign project, while the second explains the general design principles behind good POS systems.

1. What makes POS design different?

A POS is fundamentally different from a normal application.

A website might be used for a few minutes. A POS can be used by the same employee hundreds of times per day.

That means tiny UX problems become huge problems.

For example:

If adding an item takes 2 extra seconds, and a cashier does it 500 times:

2 × 500 = 1,000 seconds ≈ 17 minutes wasted every day.

So POS design is about:

Speed
Accuracy
Muscle memory
Low cognitive load
Error recovery
Consistency
Physical hardware
Real-world workflows

Not simply aesthetics.

2. Start with research, not Figma

The Swiss project is probably the strongest lesson from the two articles.

The designers didn't start by saying:

"Let's make a beautiful POS."

They went into actual petrol stations and observed employees.

They studied:

Real transactions
Cashier behavior
Customer behavior
Existing shortcuts
Common errors
Transaction complexity
Hardware
Environmental conditions
Different workflows

They observed 532 transactions, 36 cashiers and conducted 24 interviews across 7 stations.

The lesson

Before designing your restaurant POS, you should understand:

How does the cashier actually take an order?

For example:

Customer:
"One zinger burger, fries, and Pepsi."

Cashier:
1. Finds burger
2. Adds burger
3. Selects size
4. Adds fries
5. Adds drink
6. Changes drink size
7. Checks order
8. Takes payment
9. Prints receipt

You should design around that actual sequence.

3. Design for the cashier's mental model

The POS should match how the employee thinks about the job.

A cashier doesn't think:

"I need to navigate to the Food Category component."

They think:

"Customer wants a burger."

Therefore, the UI should make the natural task obvious.

DON'T

Organize everything according to how your database is structured:

Products
├── Category ID
├── Product Type
├── SKU
├── Variant
└── Modifier
DO

Organize it according to the restaurant's workflow:

BURGERS
PIZZAS
FRIES
DRINKS
DEALS
EXTRAS

The database can be complex.

The interface doesn't need to be.

4. Speed matters—but don't blindly minimize clicks

One of the most important ideas from the second article is that:

Fewer clicks doesn't automatically mean better UX.

Suppose you have 30 products on one screen.

You might technically reduce the number of clicks.

But now the cashier has to visually search through 30 items.

That's slower.

DON'T
[ Burger ][ Pizza ][ Fries ][ Coke ][ Deal ]
[ Wings  ][ Salad ][ Tea   ][ Water][ Sauce]
[ ... 20 more products ... ]
DO

Use meaningful grouping:

┌───────────────┐
│  BURGERS      │
│  [Zinger]     │
│  [Beef]       │
│  [Chicken]    │
└───────────────┘

┌───────────────┐
│  DEALS        │
│  [Deal 1]     │
│  [Deal 2]     │
└───────────────┘

The goal isn't:

minimum clicks

The goal is:

minimum effort + minimum thinking + minimum errors.

5. Optimize the 80% workflow

Not every operation deserves equal attention.

If 80% of orders involve:

Burger
Fries
Drink

then those actions should be incredibly fast.

Rare actions like refunds don't need to dominate the main screen.

DO

Make frequent operations extremely accessible.

Most used
↓
BURGERS
DEALS
DRINKS
FRIES
EXTRAS

Put rare operations somewhere safer:

More
 ├── Refund
 ├── Void
 ├── Reprint
 ├── Settings
 └── Reports
6. Support both beginners and experienced cashiers

A new employee needs guidance.

An experienced employee wants speed.

Your POS needs to support both.

Beginner
Tap:
Burger
 ↓
Choose Size
 ↓
Choose Modifier
 ↓
Add
Experienced cashier

Ideally, they can use shortcuts or common presets:

[Zinger Deal]

and get:

Zinger + Fries + Drink

in one action.

The system should teach beginners without slowing experts down.

7. Don't destroy muscle memory

This is extremely important for POS systems.

Once a cashier has used your POS for months, they know:

"Burger is here."

"Checkout is here."

"Remove item is here."

They aren't consciously looking anymore.

If you suddenly move everything because you want a "fresh redesign," productivity can drop.

DON'T

Version 1:

[ Burgers ] [ Drinks ]
[ Fries   ] [ Deals  ]

             [PAY]

Version 2:

[ Deals ] [ Fries ]
             [ Burgers ]
[PAY] [ Drinks]

Just because it looks better.

DO

Keep frequently used controls stable.

If you need to improve something, make incremental changes and test them.

8. Error recovery is a first-class feature

Mistakes are inevitable.

A cashier might:

Add the wrong item
Add the wrong quantity
Choose the wrong size
Forget an item
Apply the wrong discount
Take the wrong payment
Need to cancel an item

Your POS shouldn't make the cashier panic.

DON'T

Make cancellation buried behind:

Menu
 → Order Management
 → Edit Transaction
 → Select Item
 → Actions
 → Remove
DO

Make common corrections obvious:

ORDER
────────────────
Zinger Burger     650
Fries             200
Pepsi             100

[−] [Remove] [+]

The cashier should be able to fix mistakes without restarting the order.

9. Don't overuse confirmation dialogs

Imagine selling 500 items.

If every action asks:

"Are you sure?"

the cashier will hate your software.

DON'T
Remove Pepsi?

[Cancel] [Yes]

Every time.

DO

Use confirmation for genuinely dangerous operations:

VOID ENTIRE ORDER?

This cannot be undone.

[Cancel] [Void Order]

But normal reversible operations should usually happen immediately.

10. Don't treat the POS like a website

This is one of the biggest combined lessons.

A modern web designer might want:

Huge whitespace
Hidden navigation
Minimal buttons
Hamburger menus
Lots of animations
Beautiful cards
Fancy transitions

Those aren't automatically good for POS.

DON'T

Hide important functions behind multiple layers because:

"It looks cleaner."

DO

Make important actions visible and immediately accessible.

A POS should prioritize:

recognition > exploration

The cashier should recognize what they need instead of searching for it.

11. Visual design should improve recognition

This doesn't mean visuals are bad.

The problem is decorative visuals that don't improve usability.

For a restaurant POS, product images can actually be useful because they help cashiers identify products quickly.

DO
┌──────────────┐
│   🍔 IMAGE   │
│ ZINGER       │
│ Rs. 450      │
└──────────────┘

Especially if products have similar names.

DON'T

Add huge decorative images that make the interface slower to scan.

The image should help answer:

"Is this the thing I want?"

12. Hardware is part of UX

The Swiss case study makes this particularly clear.

A POS isn't just software.

It's:

Screen + touchscreen/mouse + printer + scanner + card machine + cash drawer + cashier + customer.

You need to understand the actual environment.

For example:

Restaurant POS

Maybe the cashier has:

15-inch touchscreen
1920×1080 display
Receipt printer
Cash drawer
Barcode scanner
Keyboard

Your UI needs to work with those constraints.

DON'T

Design only on a huge 32-inch monitor and assume everything will scale perfectly.

DO

Test on the actual machine.

13. Design for physical conditions

The Swiss project also considered environmental conditions because some terminals were outdoors.

For your restaurant, the constraints may be different.

Think about:

Screen size
Touch accuracy
Viewing distance
Brightness
Glare
Keyboard/mouse vs touchscreen
Printer speed
Network reliability
Power outages

Your software exists in a physical environment.

Design for that environment.

14. Offline and failure states matter

For a restaurant POS, this is especially important.

What happens if:

Printer disconnected

or:

Database unavailable

or:

Payment terminal unavailable

or:

Network disconnected

A POS cannot simply display:

"Something went wrong."

DON'T
Error 500
Something went wrong.
DO

Give an actionable explanation:

⚠ Receipt printer unavailable

The order is saved.

You can:
[Retry Printer]
[Print Later]
[Continue Without Printing]

The cashier should know:

What happened
Whether the order is safe
What they can do next
15. Design exceptions, not just the happy path

A beginner designer often designs:

Add product → Pay → Done

But real POS systems spend a lot of time dealing with exceptions.

Think about:

Normal order
     ↓
Payment
     ↓
Printer fails

or:

Order
 ↓
Customer changes mind
 ↓
Remove item
 ↓
Change quantity
 ↓
Apply discount
 ↓
Payment

or:

Customer wants:
2 Zinger
1 without mayo
1 extra cheese

Your UX needs to handle these naturally.

16. Don't over-customize

Customization sounds great:

"Every cashier can arrange everything however they want."

But that can create chaos.

Imagine:

Cashier A:

Burger → left side

Cashier B:

Burger → right side

Cashier C:

Burger → hidden in menu

Now training becomes difficult.

DO

Allow useful customization:

Product ordering
Favorites
Frequently used items
Some role-based settings

But maintain a consistent core workflow.

17. Build a design system

The Swiss project eventually created a shared design system.

For your POS, this doesn't need to be enormous.

Define reusable components:

Button
ProductCard
CategoryTab
OrderItem
QuantityControl
PaymentMethod
Modal
Toast
KeyboardShortcut

And standardize:

Typography
Spacing
Colors
Button states
Error states
Loading states
Disabled states
Touch targets

This prevents every screen from behaving differently.

18. Test with real cashiers

This is probably the single most important practical lesson from both articles.

You cannot fully determine good POS UX from Figma.

Give the prototype to the actual cashier.

Ask them to perform:

"Take this order."

Then watch them.

Don't immediately explain the interface.

Look for:

Where they hesitate
What they search for
What they tap accidentally
What they expect to happen
What they complain about
What shortcuts they try
What they ignore

Then improve it.

Do's vs Don'ts
✅ DO	❌ DON'T
Design around real workflows	Design only around aesthetics
Observe actual cashiers	Assume you know how they work
Optimize frequent actions	Give every action equal importance
Keep familiar controls stable	Move buttons randomly
Make errors easy to fix	Force users to restart orders
Use clear categories	Put everything on one screen
Support shortcuts	Force experts through beginner flows
Test on actual hardware	Test only on your laptop
Use images when they aid recognition	Add decoration everywhere
Give useful error messages	Show generic errors
Confirm dangerous actions	Confirm every little action
Keep core workflows consistent	Let everyone customize everything
Design edge cases	Design only the happy path
Build reusable components	Create every screen independently
Test with real users	Assume Figma approval means UX is good
Applying All of This to Your Restaurant POS

Since you're building a small restaurant POS, I would translate the two articles into this architecture:

                    POS
                     │
        ┌────────────┴────────────┐
        │                         │
      ORDER                    MANAGEMENT
        │                         │
 ┌──────┼───────┐          ┌──────┼───────┐
 │      │       │          │      │       │
Menu  Current  Customer   Orders Reports Settings
      Order
 │
 ├── Burgers
 ├── Deals
 ├── Pizza
 ├── Fries
 ├── Drinks
 └── Extras

And the main order screen should probably prioritize:

┌─────────────────────────────────────────────────────┐
│ Categories                  Current Order            │
│                                                     │
│ [Burgers]   [Zinger] [Beef Burger] [Chicken]       │
│ [Deals]     [Deal 1] [Deal 2]       [Deal 3]       │
│ [Fries]     [Fries]   [Loaded]                     │
│ [Drinks]    [Pepsi]   [7Up]          [Water]       │
│ [Extras]                                            │
│                                                     │
│                            Zinger       450         │
│                            Fries        200         │
│                            Pepsi        100         │
│                            ──────────────────       │
│                            Total       750          │
│                                                     │
│                            [ HOLD ] [ PAY ]         │
└─────────────────────────────────────────────────────┘

The cashier should be able to do the majority of orders without navigating away from this screen.

The Ultimate Rule

If you remember only one thing from both articles, remember this:

A POS is a tool for performing a job, not an app for exploring an interface.

Your job as the designer/developer isn't to make the cashier think:

"Wow, this UI is beautiful."

It's to make them think:

"I don't even have to think about using this."

That's what good POS UX looks like.
