# Rabbit Ears team tip jar

Use one Rabbit Ears Ko-fi page for the website, desktop footer and desktop Help menu. All entry points lead to https://rabbit-ears.stream/support/ so changing providers later does not require another app release.

The team chose Ko-fi. Use the shared Rabbit Ears email, a branded profile and the existing square bunny-skull logo. The account owner connects the project payout account privately. Do not put credentials, verification codes, bank details or payment API keys in either repository.

Start with Ko-fi Free for one-time tips. Ko-fi lists a 0% service fee on those tips when Standard mode is off; payment-processor fees still apply. Monthly tips and other features have different fees. Source: https://help.ko-fi.com/hc/en-us/articles/360002506494-Does-Ko-fi-take-a-fee

Payments go directly to the connected PayPal or Stripe account. Use a dedicated project payout account and keep a record of hosting, tooling, caption processing and team expenses. Manage appropriate teammate access in the payment provider rather than putting money into separate personal tip jars. No recipient, payout owner, teammate access or revenue split is assumed by the code.

Public page supplied by the account owner: https://ko-fi.com/rabbitears. The support page links to it, and both repositories use `ko_fi: rabbitears` in .github/FUNDING.yml. Site/app links go through the project support page; GitHub’s Sponsor button points to the same Ko-fi fund directly.

The owner reported finishing the account/payout setup privately. Automated verification of the public Ko-fi page is blocked by Ko-fi’s anti-bot response, so no checkout or payment success is claimed. No test charge was submitted. Confirm the live checkout identifies Rabbit Ears before sharing a fundraising announcement.

The UI changes are independent of programming, captions, scheduling and the audio engine. Support remains optional; watching remains free.
