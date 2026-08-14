Feature: Best sellers
  The till surfaces top products by units sold, computed over the trailing 30 days
  and falling back to all-time when that window is empty.

  Scenario: Products are ranked by units sold, descending
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Cola |
      | price   | 2    |
      | category| Drinks |
      | quantity| 50   |
      | stock   | 1    |
    And I sell 2 of the created product for 2 each
    When I create a product with form:
      | name    | Fries |
      | price   | 3     |
      | category| Snacks |
      | quantity| 50    |
      | stock   | 1     |
    And I sell 5 of the created product for 3 each
    When I fetch the best sellers
    Then the top best seller should be the created product

  Scenario: Falls back to all-time ranking when the 30-day window is empty
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Legacy Pie |
      | price   | 4          |
      | category| Snacks     |
      | quantity| 50         |
      | stock   | 1          |
    And I remember the created product id as "legacy"
    When I sell 9 of the created product for 4 each dated "2000-01-01T12:00:00.000Z"
    When I fetch the best sellers
    Then the top best seller should be the created product

  Scenario: Best sellers respect the till scope
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Till1 Item |
      | price   | 5          |
      | category| Snacks     |
      | quantity| 50         |
      | stock   | 1          |
    And I sell 4 of the created product for 5 each on till 1
    When I create a product with form:
      | name    | Till2 Item |
      | price   | 6          |
      | category| Snacks     |
      | quantity| 50         |
      | stock   | 1          |
    And I sell 7 of the created product for 6 each on till 2
    When I fetch the best sellers
    Then the response body should have 2 items
