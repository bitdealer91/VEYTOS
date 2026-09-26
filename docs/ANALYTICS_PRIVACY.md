# Beta analytics and privacy

VEYTOS emits a small first-party event vocabulary for page views and key mint/trade transitions. Events contain the event name, current route, coarse non-identifying product properties, and server receipt time. Wallet addresses, NFT ownership inventories, transaction signing payloads, IP-derived identifiers, private keys, seed phrases, and RPC credentials are not analytics properties.

The web client honors browser Do Not Track. The default endpoint writes structured events to the deployment log drain; operators should configure short retention and aggregate counts. Aptos transactions remain public independently of VEYTOS analytics. Product analytics are never used to authorize blockchain actions.
