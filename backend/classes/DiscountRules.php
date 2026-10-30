<?php
class DiscountRules
{
    public const ACTIVE_SQL = "d.is_active = 1 AND (d.start_date IS NULL OR d.start_date <= NOW()) AND (d.end_date IS NULL OR d.end_date >= NOW())";
}
