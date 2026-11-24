import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasLockedAt = await knex.schema.hasColumn("emails", "locked_at");
  if (!hasLockedAt) {
    await knex.schema.alterTable("emails", (table) => {
      table.timestamp("locked_at").nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasLockedAt = await knex.schema.hasColumn("emails", "locked_at");
  if (hasLockedAt) {
    await knex.schema.alterTable("emails", (table) => {
      table.dropColumn("locked_at");
    });
  }
}
