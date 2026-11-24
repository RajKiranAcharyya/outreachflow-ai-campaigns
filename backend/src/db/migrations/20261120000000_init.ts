import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .createTable("contacts", (table) => {
      table.increments("id").primary();
      table.string("email").unique().notNullable();
      table.string("first_name");
      table.string("last_name");
      table.string("company");
      table.string("role");
      table.string("note");
      table.string("status").defaultTo("active");
      table.timestamp("created_at").defaultTo(knex.fn.now());
    })
    .createTable("campaigns", (table) => {
      table.increments("id").primary();
      table.string("name").notNullable();
      table.string("status").defaultTo("draft");
      table.integer("daily_limit");
      table.timestamp("created_at").defaultTo(knex.fn.now());
    })
    .createTable("campaign_steps", (table) => {
      table.increments("id").primary();
      table.integer("campaign_id").references("id").inTable("campaigns").onDelete("CASCADE");
      table.integer("step_number");
      table.integer("delay_minutes");
      table.text("subject_template");
      table.text("body_template");
    })
    .createTable("enrollments", (table) => {
      table.increments("id").primary();
      table.integer("campaign_id").references("id").inTable("campaigns").onDelete("CASCADE");
      table.integer("contact_id").references("id").inTable("contacts").onDelete("CASCADE");
      table.string("status").defaultTo("active");
      table.integer("current_step").defaultTo(1);
      table.text("ai_opening");
      table.unique(["campaign_id", "contact_id"]);
    })
    .createTable("emails", (table) => {
      table.increments("id").primary();
      table.integer("enrollment_id").references("id").inTable("enrollments").onDelete("CASCADE");
      table.integer("step_number");
      table.string("status").defaultTo("pending");
      table.integer("attempts").defaultTo(0);
      table.timestamp("next_attempt_at");
      table.string("idempotency_key").unique();
      table.string("subject");
      table.text("body");
      table.string("last_error");
      table.timestamp("sent_at");
      table.timestamp("opened_at");
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .dropTableIfExists("emails")
    .dropTableIfExists("enrollments")
    .dropTableIfExists("campaign_steps")
    .dropTableIfExists("campaigns")
    .dropTableIfExists("contacts");
}
