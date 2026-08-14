Feature: Reports and analytics
  Managers review sales performance by date range, category, and payment method.

  Scenario: A sales summary returns totals, category and payment breakdowns
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Report Cola |
      | price   | 5           |
      | category| Drinks      |
      | quantity| 50          |
      | stock   | 1           |
    And I sell 2 of the created product for 5 each
    When I fetch the sales summary between "1970-01-01" and "2100-01-01"
    Then the response status should be 200
    And the response body "summary.saleCount" should be "1"
    And the response body "summary.totalSales" should be "10"
    And the response body "byCategory" should have 1 items
    And the response body "byPaymentMethod" should have 1 items

  Scenario: The sales summary excludes refunds from paid totals
    Given I am logged in as an admin
    When I create a refunded sale
    When I fetch the sales summary between "1970-01-01" and "2100-01-01"
    Then the response body "summary.saleCount" should be "0"

  Scenario: An invalid date range is rejected
    Given I am logged in as an admin
    When I fetch the sales summary between "not-a-date" and "2100-01-01"
    Then the response status should be 400

  Scenario: The summary can be scoped to a till
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Till Cola |
      | price   | 4         |
      | category| Drinks    |
      | quantity| 50        |
      | stock   | 1         |
    And I sell 1 of the created product for 4 each on till 2
    When I fetch the sales summary between "1970-01-01" and "2100-01-01"
    Then the response body "summary.saleCount" should be "1"
