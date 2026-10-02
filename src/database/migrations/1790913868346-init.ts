import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1790913868346 implements MigrationInterface {
  name = 'Init1790913868346';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "actors" ("id" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d8608598c2c4f907a78de2ae461" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."units_group_enum" AS ENUM('length', 'mass', 'volume', 'electrical', 'temperature', 'pieces', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "units" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "symbol" character varying(20) NOT NULL, "group" "public"."units_group_enum" NOT NULL DEFAULT 'other', CONSTRAINT "PK_5a8f2f064919b587d93936cb223" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "attribute_options" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "attribute_definition_id" uuid NOT NULL, "value" character varying(100) NOT NULL, "label" character varying(200) NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "uq_attribute_options_def_value" UNIQUE ("attribute_definition_id", "value"), CONSTRAINT "PK_696cd598705915238f202da10a6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attribute_options_def_id" ON "attribute_options"  ("attribute_definition_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."attribute_definitions_data_type_enum" AS ENUM('text', 'long_text', 'number', 'boolean', 'date', 'enum', 'multi_enum', 'reference', 'file', 'money')`,
    );
    await queryRunner.query(
      `CREATE TABLE "attribute_definitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "key" character varying(100) NOT NULL, "label" character varying(200) NOT NULL, "data_type" "public"."attribute_definitions_data_type_enum" NOT NULL, "unit_id" uuid, "is_required" boolean NOT NULL DEFAULT false, "is_multiple" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_0343fd5c80d17db91101119df88" UNIQUE ("key"), CONSTRAINT "PK_0430dd4f09c3ff09daa16484676" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attribute_definitions_unit_id" ON "attribute_definitions"  ("unit_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attribute_definitions_data_type" ON "attribute_definitions"  ("data_type") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_attribute_definitions_key" ON "attribute_definitions"  ("key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(150) NOT NULL, "code" character varying(100), "parent_id" uuid, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_categories_code" ON "categories"  ("code") WHERE code IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_categories_parent_id" ON "categories"  ("parent_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "color" character varying(30), CONSTRAINT "UQ_d90243459a697eadb8ad56e9092" UNIQUE ("name"), CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_tags_name" ON "tags"  ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "attribute_values" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "part_id" uuid NOT NULL, "attribute_definition_id" uuid NOT NULL, "value_string" text, "value_number" numeric(18,6), "value_boolean" boolean, "value_date" TIMESTAMP WITH TIME ZONE, "value_option_id" uuid, "value_reference_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3babf93d1842d73e7ba849c0160" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attribute_values_reference_id" ON "attribute_values"  ("value_reference_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attribute_values_option_id" ON "attribute_values"  ("value_option_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attribute_values_def_id" ON "attribute_values"  ("attribute_definition_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attribute_values_part_def" ON "attribute_values"  ("part_id", "attribute_definition_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "parts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "sku" character varying(100) NOT NULL, "description" text, "quantity" integer NOT NULL DEFAULT '0', "category_id" uuid, "attributes_snapshot" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "UQ_2d1c72942ded6b48c5b03036db9" UNIQUE ("sku"), CONSTRAINT "PK_daa5595bb8933f49ac00c9ebc79" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_parts_attributes_snapshot_gin" ON "parts"  ("attributes_snapshot") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_parts_created_at" ON "parts"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_parts_category_id" ON "parts"  ("category_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_parts_sku" ON "parts"  ("sku") `,
    );
    await queryRunner.query(
      `CREATE TABLE "attribute_value_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "part_id" uuid NOT NULL, "attribute_definition_id" uuid NOT NULL, "change_type" character varying(20) NOT NULL, "old_value_string" text, "old_value_number" numeric(15,4), "old_value_boolean" boolean, "old_value_date" TIMESTAMP WITH TIME ZONE, "old_value_option_id" uuid, "old_value_reference_id" uuid, "new_value_string" text, "new_value_number" numeric(15,4), "new_value_boolean" boolean, "new_value_date" TIMESTAMP WITH TIME ZONE, "new_value_option_id" uuid, "new_value_reference_id" uuid, "changed_by" integer NOT NULL, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_271495706d6e6402bce9e1adc93" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attr_val_hist_def" ON "attribute_value_history"  ("attribute_definition_id", "changed_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attr_val_hist_changed_by" ON "attribute_value_history"  ("changed_by", "changed_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attr_val_hist_part_def" ON "attribute_value_history"  ("part_id", "attribute_definition_id", "changed_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attr_val_hist_part_changed_at" ON "attribute_value_history"  ("part_id", "changed_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "stock_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "part_id" uuid NOT NULL, "movement_type" character varying(30) NOT NULL, "quantity_delta" integer NOT NULL, "quantity_after" integer NOT NULL, "reason" character varying(500), "reference_doc" character varying(255), "performed_by" integer NOT NULL, "performed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_57a26b190618550d8e65fb860e7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_stock_movements_ref_doc" ON "stock_movements"  ("reference_doc") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_stock_movements_type" ON "stock_movements"  ("movement_type", "performed_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_stock_movements_performed_by" ON "stock_movements"  ("performed_by", "performed_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_stock_movements_perf_at" ON "stock_movements"  ("performed_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_stock_movements_part_perf_at" ON "stock_movements"  ("part_id", "performed_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "part_tags" ("part_id" uuid NOT NULL, "tag_id" uuid NOT NULL, CONSTRAINT "PK_735df91ba76456f142e2c2395ea" PRIMARY KEY ("part_id", "tag_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c1e6432029f3933d51de709123" ON "part_tags"  ("part_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ecf60a0399a11cc4e52b97a354" ON "part_tags"  ("tag_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_options" ADD CONSTRAINT "FK_e9a7611e4892e68b80dd8221505" FOREIGN KEY ("attribute_definition_id") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_definitions" ADD CONSTRAINT "FK_3f1062b695d57fa91087b7e4a7e" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_88cea2dc9c31951d06437879b40" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_values" ADD CONSTRAINT "FK_a715246a2fcc5a3bb302dafcc00" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_values" ADD CONSTRAINT "FK_8a032f3dac2d4e92022d1bdcaae" FOREIGN KEY ("attribute_definition_id") REFERENCES "attribute_definitions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_values" ADD CONSTRAINT "FK_d3910e0d2752ddf07897552aea0" FOREIGN KEY ("value_option_id") REFERENCES "attribute_options"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "parts" ADD CONSTRAINT "FK_bdf3ba57579988536b6ccfcf988" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_value_history" ADD CONSTRAINT "FK_44aee667c5b23c2d347014037ea" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_value_history" ADD CONSTRAINT "FK_714578f75406576ae251d3af8c5" FOREIGN KEY ("attribute_definition_id") REFERENCES "attribute_definitions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_value_history" ADD CONSTRAINT "FK_3ca64efa5648aec3f9bc801651b" FOREIGN KEY ("old_value_option_id") REFERENCES "attribute_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_value_history" ADD CONSTRAINT "FK_10f5fe3e5ab39d201774106ae00" FOREIGN KEY ("new_value_option_id") REFERENCES "attribute_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_value_history" ADD CONSTRAINT "FK_a11d3c8b1d0b4c99b1f663970b3" FOREIGN KEY ("changed_by") REFERENCES "actors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_f97a2ef8af9e019a28dba407c98" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_8a1479840f8ba413f8d5c95c52e" FOREIGN KEY ("performed_by") REFERENCES "actors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "part_tags" ADD CONSTRAINT "FK_c1e6432029f3933d51de709123e" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "part_tags" ADD CONSTRAINT "FK_ecf60a0399a11cc4e52b97a3549" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "part_tags" DROP CONSTRAINT "FK_ecf60a0399a11cc4e52b97a3549"`,
    );
    await queryRunner.query(
      `ALTER TABLE "part_tags" DROP CONSTRAINT "FK_c1e6432029f3933d51de709123e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_8a1479840f8ba413f8d5c95c52e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_f97a2ef8af9e019a28dba407c98"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_value_history" DROP CONSTRAINT "FK_a11d3c8b1d0b4c99b1f663970b3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_value_history" DROP CONSTRAINT "FK_10f5fe3e5ab39d201774106ae00"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_value_history" DROP CONSTRAINT "FK_3ca64efa5648aec3f9bc801651b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_value_history" DROP CONSTRAINT "FK_714578f75406576ae251d3af8c5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_value_history" DROP CONSTRAINT "FK_44aee667c5b23c2d347014037ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "parts" DROP CONSTRAINT "FK_bdf3ba57579988536b6ccfcf988"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_values" DROP CONSTRAINT "FK_d3910e0d2752ddf07897552aea0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_values" DROP CONSTRAINT "FK_8a032f3dac2d4e92022d1bdcaae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_values" DROP CONSTRAINT "FK_a715246a2fcc5a3bb302dafcc00"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_88cea2dc9c31951d06437879b40"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_definitions" DROP CONSTRAINT "FK_3f1062b695d57fa91087b7e4a7e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_options" DROP CONSTRAINT "FK_e9a7611e4892e68b80dd8221505"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ecf60a0399a11cc4e52b97a354"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c1e6432029f3933d51de709123"`,
    );
    await queryRunner.query(`DROP TABLE "part_tags"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_stock_movements_part_perf_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_stock_movements_perf_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_stock_movements_performed_by"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_stock_movements_type"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_stock_movements_ref_doc"`,
    );
    await queryRunner.query(`DROP TABLE "stock_movements"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_attr_val_hist_part_changed_at"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_attr_val_hist_part_def"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_attr_val_hist_changed_by"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_attr_val_hist_def"`);
    await queryRunner.query(`DROP TABLE "attribute_value_history"`);
    await queryRunner.query(`DROP INDEX "public"."idx_parts_sku"`);
    await queryRunner.query(`DROP INDEX "public"."idx_parts_category_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_parts_created_at"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_parts_attributes_snapshot_gin"`,
    );
    await queryRunner.query(`DROP TABLE "parts"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_attribute_values_part_def"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_attribute_values_def_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_attribute_values_option_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_attribute_values_reference_id"`,
    );
    await queryRunner.query(`DROP TABLE "attribute_values"`);
    await queryRunner.query(`DROP INDEX "public"."idx_tags_name"`);
    await queryRunner.query(`DROP TABLE "tags"`);
    await queryRunner.query(`DROP INDEX "public"."idx_categories_parent_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_categories_code"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_attribute_definitions_key"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_attribute_definitions_data_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_attribute_definitions_unit_id"`,
    );
    await queryRunner.query(`DROP TABLE "attribute_definitions"`);
    await queryRunner.query(
      `DROP TYPE "public"."attribute_definitions_data_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_attribute_options_def_id"`,
    );
    await queryRunner.query(`DROP TABLE "attribute_options"`);
    await queryRunner.query(`DROP TABLE "units"`);
    await queryRunner.query(`DROP TYPE "public"."units_group_enum"`);
    await queryRunner.query(`DROP TABLE "actors"`);
  }
}
