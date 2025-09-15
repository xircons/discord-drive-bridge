exports.up = function(knex) {
  return knex.schema.createTable('rate_limits', function(table) {
    table.bigInteger('user_id').notNullable();
    table.string('command', 50).notNullable();
    table.integer('count').defaultTo(1);
    table.timestamp('window_start').defaultTo(knex.fn.now());
    
    table.primary(['user_id', 'command']);
    table.index(['user_id']);
    table.index(['command']);
    table.index(['window_start']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('rate_limits');
};
