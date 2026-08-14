Feature: Catalog and product management
  Managers maintain the sellable catalog: products, variants, modifiers, combos,
  cost, stock tracking, hot flags, and bulk deletion.

  Scenario: A product can be created and appears in the catalog
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Test Cola |
      | price   | 25        |
      | category| Drinks    |
      | quantity| 40        |
      | stock   | 1         |
      | cost    | 10        |
    Then the response status should be 200
    And the product list should include "Test Cola"
    And product "Test Cola" should have quantity 40

  Scenario: An untracked product is created with stock disabled
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Fresh Fries |
      | price   | 30          |
      | category| Snacks      |
      | quantity| 0           |
      | stock   | 0           |
    Then the response status should be 200
    When I fetch the created product
    Then the response body "trackStock" should be "false"

  Scenario: A product can be flagged hot
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Daily Special |
      | price   | 99            |
      | category| Deals         |
      | quantity| 10            |
      | stock   | 1             |
      | hot     | 1             |
    Then the response status should be 200
    And product "Daily Special" should be hot

  Scenario: Toggling the hot flag via the dedicated endpoint works
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Toggle Me |
      | price   | 50        |
      | category| Deals     |
      | quantity| 5         |
      | stock   | 1         |
    When I mark the created product hot
    Then the response status should be 200
    And product "Toggle Me" should be hot

  Scenario: A product can carry size variants
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Margherita |
      | price   | 70         |
      | category| Pizzas     |
      | quantity| 20         |
      | stock   | 1          |
      | sizes   | [{"name":"Small","price":70},{"name":"Large","price":120}] |
    Then the response status should be 200
    When I fetch the created product
    Then the response body "sizes" should have 2 items

  Scenario: A product can carry modifier groups
    Given I am logged in as an admin
    When I create a product with form:
      | name       | Loaded Fries |
      | price      | 35           |
      | category   | Snacks       |
      | quantity   | 15           |
      | stock      | 1            |
      | modifiers  | [{"name":"Extras","options":[{"name":"Cheese","priceDelta":8}]}] |
    Then the response status should be 200
    When I fetch the created product
    Then the response body "modifiers" should have 1 items

  Scenario: A combo product records its components
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Base Bun |
      | price   | 20       |
      | category| Snacks   |
      | quantity| 10       |
      | stock   | 1        |
    And I remember the created product id as "base"
    When I create a product with form:
      | name        | Burger Combo |
      | price       | 95           |
      | category    | Deals        |
      | quantity    | 10           |
      | stock       | 1            |
      | components  | [{"id":{{base}},"quantity":1}] |
    Then the response status should be 200
    When I fetch the created product
    Then the response body "components" should have 1 items

  Scenario: A product can be updated
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Old Name |
      | price   | 10       |
      | category| Drinks   |
      | quantity| 5        |
      | stock   | 1        |
    When I update the created product with form:
      | name    | New Name |
      | price   | 15       |
      | category| Drinks   |
      | quantity| 8        |
      | stock   | 1        |
    Then the response status should be 200
    And the product list should include "New Name"

  Scenario: A product can be deleted
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Delete Me |
      | price   | 10        |
      | category| Drinks    |
      | quantity| 5         |
      | stock   | 1         |
    When I delete the created product
    Then the response status should be 200
    And the product list should not include "Delete Me"

  Scenario: Multiple products can be bulk deleted
    Given I am logged in as an admin
    When I create a product with form:
      | name    | Bulk A |
      | price   | 10     |
      | category| Drinks |
      | quantity| 5      |
      | stock   | 1      |
    When I create a product with form:
      | name    | Bulk B |
      | price   | 10     |
      | category| Drinks |
      | quantity| 5      |
      | stock   | 1      |
    When I bulk delete all created products
    Then the response status should be 200
    And the response body "deleted" should be "2"
