# Rabbit Ears team tip jar

Use one Rabbit Ears Ko-fi page for the website, desktop footer and desktop Help menu. All entry points lead to https://rabbit-ears.stream/support/ so changing providers later does not require another app release.

The team chose Ko-fi. Use the shared Rabbit Ears email, a branded profile and the existing square bunny-skull logo. The account owner connects the project payout account privately. Do not put credentials, verification codes, bank details or payment API keys in either repository.

Start with Ko-fi Free for one-time tips. Ko-fi lists a 0% service fee on those tips when Standard mode is off; payment-processor fees still apply. Monthly tips and other features have different fees. Source: https://help.ko-fi.com/hc/en-us/articles/360002506494-Does-Ko-fi-take-a-fee

Payments go directly to the connected PayPal or Stripe account. Use a dedicated project payout account and keep a record of hosting, tooling, caption processing and team expenses. Manage appropriate teammate access in the payment provider rather than putting money into separate personal tip jars. No recipient, payout owner, teammate access or revenue split is assumed by the code.

Activation: replace the setup paragraph in support/index.html with the verified public Ko-fi page link after the owner finishes setup. Add the same verified Ko-fi username to .github/FUNDING.yml in both repositories to expose GitHub’s Sponsor button. Confirm the checkout identifies Rabbit Ears; do not submit a test charge without the owner's instruction. No Ko-fi checkout or payout was created by the code.

The UI changes are independent of programming, captions, scheduling and the audio engine. Support remains optional; watching remains free.
