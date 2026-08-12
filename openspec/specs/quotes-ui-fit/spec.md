# Quotes UI Fit — Delta

## ADDED Requirements

### Requirement: Missing Client Label is "Sin cliente"

`QuoteList` MUST render the literal Spanish string "Sin cliente" in the client column when a quote has no associated client (`client_id` is null or client is otherwise absent). The system MUST NOT render an em-dash ("—") as the sole placeholder for a missing client. The label MUST be visually distinguishable as a placeholder (muted color / chip variant) but MUST remain human-readable Spanish copy.

#### Scenario: Quote without client shows Spanish label

- GIVEN a quote row with `client_id = null`
- WHEN the user views the row in `QuoteList`
- THEN the client column displays the text "Sin cliente"
- AND no em-dash "—" placeholder is the sole visible content

#### Scenario: Quote with client shows client name

- GIVEN a quote row with a valid client reference
- WHEN the user views the row in `QuoteList`
- THEN the client column displays the client's name
- AND the "Sin cliente" label is NOT shown

#### Scenario: Sort and filter behavior unchanged

- GIVEN a mix of quotes with and without clients
- WHEN the user sorts by the client column or filters the list
- THEN sort and filter operate on the underlying `client_id`
- AND the "Sin cliente" rows remain consistent with their null client values
