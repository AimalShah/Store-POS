Feature: Permissions and authentication
  Endpoints are gated by a valid token and, where relevant, by per-feature permissions.
  The default admin (user id 1) bypasses all permission checks.

  Scenario: The health endpoint is public
    When I send a GET request to "/api/health"
    Then the response status should be 200

  Scenario: The ready-check endpoint is public
    When I send a GET request to "/api/users/check"
    Then the response status should be 200

  Scenario: A protected endpoint rejects a missing token
    When I send a GET request to "/api/inventory/products" without authentication
    Then the response status should be 401

  Scenario: The admin can create products
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Admin Product |
      | price   | 10            |
      | category| Drinks        |
      | quantity| 5             |
      | stock   | 1             |
    Then the response status should be 200

  Scenario: A cashier without product permission is forbidden from creating products
    Given I log in as a cashier with PIN "5151" and no product permission
    When I create a product with form:
      | name    | Forbidden Product |
      | price   | 10                |
      | category| Drinks            |
      | quantity| 5                 |
      | stock   | 1                 |
    Then the response status should be 403

  Scenario: A cashier with the product permission can create products
    Given I log in as a cashier with permissions "perm_products"
    When I create a product with form:
      | name    | Allowed Product |
      | price   | 10              |
      | category| Drinks          |
      | quantity| 5               |
      | stock   | 1               |
    Then the response status should be 200
