Feature: Reports accuracy — KPIs and sales data are true, not manipulated
  Every figure shown on the Dashboard and in the Reports must equal the exact
  arithmetic of the underlying paid sales. Refunds and held orders must be
  excluded, and shift X/Z reports must reconcile to the actual sales.

  Scenario: The sales summary reflects tax, discount and totals exactly
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Acc Cola |
      | price   | 10       |
      | category| Drinks   |
      | quantity| 50       |
      | stock   | 1        |
    And I remember the created product id as "colaId"
    When I create a sale with JSON:
      """
      {
        "items": [{ "id": {{colaId}}, "name": "Acc Cola", "price": 10, "quantity": 2, "cost": 2 }],
        "subtotal": 20,
        "discount": 5,
        "tax": 2,
        "total": 17,
        "paid": 17,
        "payment_breakdown": [{ "method": "cash", "amount": 17 }]
      }
      """
    When I fetch the sales summary between "1970-01-01" and "2100-01-01"
    Then the response status should be 200
    And the response body "summary.saleCount" should be "1"
    And the response body "summary.subtotal" should be "20"
    And the response body "summary.discount" should be "5"
    And the response body "summary.tax" should be "2"
    And the response body "summary.totalSales" should be "17"
    And the response body "byCategory" should have 1 items
    And the response body "byPaymentMethod" should have 1 items

  Scenario: A split-payment sale is summed across both methods
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Split Item |
      | price   | 10         |
      | category| Food       |
      | quantity| 50         |
      | stock   | 1          |
    When I create a sale with JSON:
      """
      {
        "items": [{ "name": "Split Item", "price": 10, "quantity": 1, "cost": 2 }],
        "subtotal": 10,
        "total": 10,
        "description": "split",
        "paid": 10,
        "payment_breakdown": [{ "method": "cash", "amount": 6 }, { "method": "card", "amount": 4 }]
      }
      """
    When I fetch the sales summary between "1970-01-01" and "2100-01-01"
    Then the response body "summary.totalSales" should be "10"
    And the response body "byPaymentMethod" should have 2 items
    And the response body "byPaymentMethod[0].amount" should be "6"
    And the response body "byPaymentMethod[1].amount" should be "4"

  Scenario: Best sellers rank by units sold and revenue
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Best A |
      | price   | 5      |
      | category| Drinks |
      | quantity| 50     |
      | stock   | 1      |
    When I sell 3 of the created product for 5 each
    And I create a product with form:
      | name    | Best B |
      | price   | 20     |
      | category| Food   |
      | quantity| 50     |
      | stock   | 1      |
    When I sell 3 of the created product for 20 each
    And I create a product with form:
      | name    | Best C |
      | price   | 30     |
      | category| Food   |
      | quantity| 50     |
      | stock   | 1      |
    When I sell 3 of the created product for 30 each
    When I fetch the best sellers
    Then the response body should have 3 items
    And the top best seller should be the created product

  Scenario: By-date returns exactly the sales in the window
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Date Item |
      | price   | 7         |
      | category| Drinks   |
      | quantity| 50       |
      | stock   | 1        |
    When I sell 1 of the created product for 7 each dated "2020-01-01T00:00:00Z"
    And I sell 1 of the created product for 7 each
    When I fetch transactions between "2024-01-01" and "2030-01-01"
    Then the response body should have 1 items

  Scenario: Shift X and Z reports reconcile to the sales
    Given I am logged in as an admin
    When I open a shift with float 50
    When I create a product with form:
      | name    | Shift Item |
      | price   | 10         |
      | category| Drinks    |
      | quantity| 50        |
      | stock   | 1         |
    When I create a sale in the open shift with JSON:
      """
      {
        "items": [{ "name": "Shift Item", "price": 10, "quantity": 1, "cost": 2 }],
        "subtotal": 10,
        "total": 10,
        "paid": 10,
        "payment_breakdown": [{ "method": "cash", "amount": 10 }]
      }
      """
    When I fetch the X report for the shift
    Then the response body "totalSales" should be "10"
    And the response body "cashSales" should be "10"
    And the response body "saleCount" should be "1"
    And the response body "refundCount" should be "0"
    When I close the open shift with counted cash 50
    When I fetch the Z report for the shift
    Then the response body "expectedCash" should be "60"
    And the response body "actualCash" should be "50"
    And the response body "difference" should be "-10"

  Scenario: Refunds are excluded from paid totals but counted in reports
    Given I am logged in as an admin
    When I open a shift with float 0
    When I create a product with form:
      | name    | Refund Item |
      | price   | 9           |
      | category| Drinks      |
      | quantity| 50          |
      | stock   | 1           |
    When I create a sale in the open shift with JSON:
      """
      {
        "status": 2,
        "items": [{ "name": "Refund Item", "price": 9, "quantity": 1, "cost": 2 }],
        "subtotal": 9,
        "total": 9,
        "paid": 9,
        "payment_breakdown": [{ "method": "cash", "amount": 9 }]
      }
      """
    When I fetch the sales summary between "1970-01-01" and "2100-01-01"
    Then the response body "summary.saleCount" should be "0"
    When I fetch the X report for the shift
    Then the response body "saleCount" should be "0"
    And the response body "refundCount" should be "1"
