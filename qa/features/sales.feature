Feature: Sales and the till
  Cashiers build orders at the till, take payment, and complete sales. Paid sales
  receive a sequential invoice number and deduct stock; held orders can be resumed.

  Scenario: A paid sale receives a sequential invoice number
    Given I am logged in as an admin
    When I create a paid sale
    Then the response status should be 200
    And the last invoice number should match "INV-\d{8}-\d{3}"

  Scenario: A held order is not invoiced and appears in held orders
    Given I am logged in as an admin
    When I create a held order
    Then the response status should be 200
    When I fetch held orders
    Then the response body should have 1 items

  Scenario: Completing a held order assigns an invoice number
    Given I am logged in as an admin
    When I create a held order
    When I complete the held order as paid
    Then the response status should be 200
    And the last invoice number should match "INV-\d{8}-\d{3}"

  Scenario: Split payment sums the amount paid from its parts
    Given I am logged in as an admin
    When I create a split-payment sale with cash 3 and card 2
    Then the response status should be 200
    When I fetch the created sale
    Then the response body "paid" should be "5"

  Scenario: Change is computed only on the cash line when cash overpays
    Given I am logged in as an admin
    When I create a cash sale tendered 7 for total 5
    Then the response status should be 200
    And the last sale change should be 2

  Scenario: Change is zero when cash does not cover the total
    Given I am logged in as an admin
    When I create a split-payment sale with cash 3 and card 2
    Then the response status should be 200
    And the last sale change should be 0

  Scenario: Change is zero when no cash is used
    Given I am logged in as an admin
    When I create a split-payment sale with cash 0 and card 5
    Then the response status should be 200
    And the last sale change should be 0

  Scenario: Stock is deducted for a tracked product on a paid sale
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Stocked Cola |
      | price   | 5            |
      | category| Drinks       |
      | quantity| 10           |
      | stock   | 1            |
    When I sell 3 of the created product for 5 each
    Then the response status should be 200
    And product "Stocked Cola" should have quantity 7
    And the stock movements for the product should include a "sale" of 3

  Scenario: Stock is not deducted for an untracked product
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Fresh Fries |
      | price   | 5            |
      | category| Snacks       |
      | quantity| 10           |
      | stock   | 0            |
    When I sell 2 of the created product for 5 each
    Then the response status should be 200
    And product "Fresh Fries" should have quantity 10

  Scenario: Fulfillment is recorded on the sale
    Given I am logged in as an admin
    When I create a paid sale with fulfillment "dine-in"
    When I fetch the created sale
    Then the response body "fulfillment" should be "dine-in"

  Scenario: Delivery captures customer name, contact and address
    Given I am logged in as an admin
    When I create a delivery sale with name "Jo" contact "0821234567" address "Sandton"
    When I fetch the created sale
    Then the response body "fulfillment" should be "delivery"
    And the response body "delivery_name" should be "Jo"
    And the response body "delivery_contact" should be "0821234567"
    And the response body "delivery_address" should be "Sandton"

  Scenario: An order discount is stored on the sale
    Given I am logged in as an admin
    When I create a sale with discount 1
    When I fetch the created sale
    Then the response body "discount" should be "1"

  Scenario: Tax is stored on the sale
    Given I am logged in as an admin
    When I create a sale with tax 0.5
    When I fetch the created sale
    Then the response body "tax" should be "0.5"

  Scenario: A completed sale is visible in the transaction history
    Given I am logged in as an admin
    When I create a paid sale
    When I fetch recent transactions
    Then the response body should have 1 items

  Scenario: A transaction can be deleted
    Given I am logged in as an admin
    When I create a paid sale
    When I delete the created sale
    Then the response status should be 200
    When I fetch all transactions
    Then the response body should have 0 items

  Scenario: A refunded sale is excluded from paid sales summary
    Given I am logged in as an admin
    When I create a refunded sale
    When I fetch the sales summary between "1970-01-01" and "2100-01-01"
    Then the response body "summary.saleCount" should be "0"
