-- ============================================================================
-- Migrasi 0013: Salin Menu & Gambar dari SAIKO RAMEN ke KAITEKI RAMEN
-- Bersifat idempotent (aman dijalankan ulang di dev maupun produksi).
-- ============================================================================

DO $$
DECLARE
  v_source_outlet_id uuid;
  v_target_outlet_id uuid;
  v_cat record;
  v_target_cat_id uuid;
  v_prod record;
  v_group record;
  v_target_group_id uuid;
  v_opt record;
  v_assign record;
  v_target_prod_id uuid;
BEGIN
  SELECT id INTO v_source_outlet_id
  FROM public.outlets
  WHERE deleted_at IS NULL
    AND upper(trim(name)) = 'SAIKO RAMEN'
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_target_outlet_id
  FROM public.outlets
  WHERE deleted_at IS NULL
    AND upper(trim(name)) = 'KAITEKI RAMEN'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_source_outlet_id IS NULL OR v_target_outlet_id IS NULL THEN
    RETURN;
  END IF;

  -- 1. Salin kategori aktif
  FOR v_cat IN
    SELECT id, name, sort_order, is_active
    FROM public.categories
    WHERE outlet_id = v_source_outlet_id
      AND deleted_at IS NULL
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    SELECT id INTO v_target_cat_id
    FROM public.categories
    WHERE outlet_id = v_target_outlet_id
      AND deleted_at IS NULL
      AND lower(trim(name)) = lower(trim(v_cat.name))
    LIMIT 1;

    IF v_target_cat_id IS NULL THEN
      INSERT INTO public.categories (outlet_id, name, sort_order, is_active)
      VALUES (v_target_outlet_id, v_cat.name, v_cat.sort_order, v_cat.is_active)
      RETURNING id INTO v_target_cat_id;
    END IF;

    -- 2. Salin produk pada kategori ini beserta image_url-nya
    FOR v_prod IN
      SELECT id, name, price, image_url, is_available, is_active
      FROM public.products
      WHERE outlet_id = v_source_outlet_id
        AND category_id = v_cat.id
        AND deleted_at IS NULL
      ORDER BY created_at ASC, name ASC
    LOOP
      SELECT id INTO v_target_prod_id
      FROM public.products
      WHERE outlet_id = v_target_outlet_id
        AND deleted_at IS NULL
        AND lower(trim(name)) = lower(trim(v_prod.name))
      LIMIT 1;

      IF v_target_prod_id IS NULL THEN
        INSERT INTO public.products (
          outlet_id,
          category_id,
          name,
          price,
          image_url,
          is_available,
          is_active
        )
        VALUES (
          v_target_outlet_id,
          v_target_cat_id,
          v_prod.name,
          v_prod.price,
          v_prod.image_url,
          v_prod.is_available,
          v_prod.is_active
        );
      ELSE
        UPDATE public.products
        SET image_url = COALESCE(public.products.image_url, v_prod.image_url)
        WHERE id = v_target_prod_id;
      END IF;
    END LOOP;
  END LOOP;

  -- 3. Salin Add-On Groups, Options, & Assignments bila ada
  FOR v_group IN
    SELECT id, name, selection_type, is_required, max_select, sort_order, is_active
    FROM public.product_addon_groups
    WHERE outlet_id = v_source_outlet_id
      AND deleted_at IS NULL
  LOOP
    SELECT id INTO v_target_group_id
    FROM public.product_addon_groups
    WHERE outlet_id = v_target_outlet_id
      AND deleted_at IS NULL
      AND lower(trim(name)) = lower(trim(v_group.name))
    LIMIT 1;

    IF v_target_group_id IS NULL THEN
      INSERT INTO public.product_addon_groups (
        outlet_id,
        name,
        selection_type,
        is_required,
        max_select,
        sort_order,
        is_active
      )
      VALUES (
        v_target_outlet_id,
        v_group.name,
        v_group.selection_type,
        v_group.is_required,
        v_group.max_select,
        v_group.sort_order,
        v_group.is_active
      )
      RETURNING id INTO v_target_group_id;

      FOR v_opt IN
        SELECT name, price_delta, is_available, sort_order
        FROM public.product_addon_options
        WHERE group_id = v_group.id
          AND deleted_at IS NULL
      LOOP
        INSERT INTO public.product_addon_options (
          group_id,
          outlet_id,
          name,
          price_delta,
          is_available,
          sort_order
        )
        VALUES (
          v_target_group_id,
          v_target_outlet_id,
          v_opt.name,
          v_opt.price_delta,
          v_opt.is_available,
          v_opt.sort_order
        );
      END LOOP;
    END IF;

    FOR v_assign IN
      SELECT p.name AS product_name, a.sort_order
      FROM public.product_addon_assignments a
      JOIN public.products p ON p.id = a.product_id
      WHERE a.addon_group_id = v_group.id
        AND p.deleted_at IS NULL
    LOOP
      SELECT id INTO v_target_prod_id
      FROM public.products
      WHERE outlet_id = v_target_outlet_id
        AND deleted_at IS NULL
        AND lower(trim(name)) = lower(trim(v_assign.product_name))
      LIMIT 1;

      IF v_target_prod_id IS NOT NULL THEN
        INSERT INTO public.product_addon_assignments (
          outlet_id,
          product_id,
          addon_group_id,
          sort_order
        )
        VALUES (
          v_target_outlet_id,
          v_target_prod_id,
          v_target_group_id,
          v_assign.sort_order
        )
        ON CONFLICT (product_id, addon_group_id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;
